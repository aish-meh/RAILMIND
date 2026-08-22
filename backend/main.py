import asyncio
from fastapi import FastAPI, BackgroundTasks, WebSocket, WebSocketDisconnect, Header, Query, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import json

from models import DelayEvent, Train, Station
from mock_data import TRAINS, STATIONS
from agents import app as graph_app
from retention import (
    RetentionStatus,
    RetentionRole,
    RetentionRecord,
    RetentionAuditEntry,
    ReasonPayload,
    retention_store,
    future_iso,
)


app = FastAPI(title="RailMind MVP API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                print(f"Error broadcasting: {e}")

manager = ConnectionManager()

# Load announcements at startup
import os
ANNOUNCEMENTS_FILE = "announcements_log.json"
ANNOUNCEMENTS_LOG = []

def load_announcements():
    global ANNOUNCEMENTS_LOG
    if os.path.exists(ANNOUNCEMENTS_FILE):
        try:
            with open(ANNOUNCEMENTS_FILE, "r", encoding="utf-8") as f:
                ANNOUNCEMENTS_LOG = json.load(f)
        except Exception as e:
            print(f"Error loading announcements: {e}")
            ANNOUNCEMENTS_LOG = []
    else:
        ANNOUNCEMENTS_LOG = []

def save_announcements():
    try:
        with open(ANNOUNCEMENTS_FILE, "w", encoding="utf-8") as f:
            json.dump(ANNOUNCEMENTS_LOG, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error saving announcements: {e}")

load_announcements()

@app.get("/api/initial-state")
async def get_initial_state():
    return {
        "trains": [t.dict() for t in TRAINS],
        "stations": [s.dict() for s in STATIONS]
    }

@app.get("/api/announcements")
async def get_announcements():
    return ANNOUNCEMENTS_LOG

# Retention Policy API Endpoints

def validate_write_permission(role: str):
    if role == RetentionRole.VIEWER.value:
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Viewer role has read-only access and cannot modify retention state."
        )

@app.get("/api/retention/records", response_model=List[RetentionRecord])
async def get_retention_records(
    status: Optional[str] = Query(default=None, description="Filter by retention status (active, archived, pending_deletion, deleted)"),
    entity_type: Optional[str] = Query(default=None, description="Filter by entity type"),
    x_role: Optional[str] = Header(default="viewer", alias="X-Role")
):
    return retention_store.get_records(status=status, entity_type=entity_type)

@app.get("/api/retention/audit-trail/{record_id}", response_model=List[RetentionAuditEntry])
async def get_retention_audit_trail(
    record_id: str,
    x_role: Optional[str] = Header(default="viewer", alias="X-Role")
):
    record = retention_store.get_record(record_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Retention record '{record_id}' not found.")
    return retention_store.get_audit_trail(record_id)

@app.post("/api/retention/archive/{record_id}", response_model=RetentionRecord)
async def archive_retention_record(
    record_id: str,
    payload: Optional[ReasonPayload] = Body(default=None),
    x_role: Optional[str] = Header(default="viewer", alias="X-Role")
):
    role = (x_role or "viewer").strip().lower()
    validate_write_permission(role)

    record = retention_store.get_record(record_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Retention record '{record_id}' not found.")

    reason = payload.reason if payload and payload.reason else "Archived per retention policy"
    try:
        updated = retention_store.record_transition(
            record=record,
            new_status=RetentionStatus.ARCHIVED,
            action="archive",
            performed_by=role,
            reason=reason
        )
        return updated
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/retention/request-delete/{record_id}", response_model=RetentionRecord)
async def request_delete_retention_record(
    record_id: str,
    payload: Optional[ReasonPayload] = Body(default=None),
    x_role: Optional[str] = Header(default="viewer", alias="X-Role")
):
    role = (x_role or "viewer").strip().lower()
    validate_write_permission(role)

    record = retention_store.get_record(record_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Retention record '{record_id}' not found.")

    reason = payload.reason if payload and payload.reason else "Deletion requested pending controller approval"
    purge_date = future_iso(30)
    try:
        updated = retention_store.record_transition(
            record=record,
            new_status=RetentionStatus.PENDING_DELETION,
            action="request_delete",
            performed_by=role,
            reason=reason,
            scheduled_purge_at=purge_date
        )
        return updated
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/retention/restore/{record_id}", response_model=RetentionRecord)
async def restore_retention_record(
    record_id: str,
    payload: Optional[ReasonPayload] = Body(default=None),
    x_role: Optional[str] = Header(default="viewer", alias="X-Role")
):
    role = (x_role or "viewer").strip().lower()
    validate_write_permission(role)

    record = retention_store.get_record(record_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Retention record '{record_id}' not found.")

    reason = payload.reason if payload and payload.reason else "Restored back to active status"
    try:
        updated = retention_store.record_transition(
            record=record,
            new_status=RetentionStatus.ACTIVE,
            action="restore",
            performed_by=role,
            reason=reason
        )
        return updated
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/retention/approve-delete/{record_id}", response_model=RetentionRecord)
async def approve_delete_retention_record(
    record_id: str,
    payload: Optional[ReasonPayload] = Body(default=None),
    x_role: Optional[str] = Header(default="viewer", alias="X-Role")
):
    role = (x_role or "viewer").strip().lower()
    if role != RetentionRole.CONTROLLER.value:
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Controller role is required to approve deletion."
        )

    record = retention_store.get_record(record_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Retention record '{record_id}' not found.")

    reason = payload.reason if payload and payload.reason else "Permanent deletion approved by controller"
    try:
        updated = retention_store.record_transition(
            record=record,
            new_status=RetentionStatus.DELETED,
            action="approve_delete",
            performed_by=role,
            reason=reason,
            purged=True
        )
        return updated
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))



@app.post("/api/generate-announcement")
async def generate_announcement(event: DelayEvent):
    initial_state = {
        "delay_event": event,
        "logs": [],
        "reschedule_plan": {},
        "notifications": []
    }
    result = await graph_app.ainvoke(initial_state)
    announcements = [ann.dict() if hasattr(ann, 'dict') else ann for ann in result.get("announcements", [])]
    return {
        "severity": result.get("severity", "Minor"),
        "incident_explanation": result.get("incident_explanation"),
        "announcements": announcements
    }

@app.post("/api/inject-delay")
async def inject_delay(event: DelayEvent, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_agents, event)
    return {"status": "Delay injected. Agents are processing."}

async def run_agents(event: DelayEvent):
    initial_state = {
        "delay_event": event,
        "logs": [],
        "reschedule_plan": {},
        "notifications": []
    }
    
    # We will iterate through the graph and broadcast state updates
    async for output in graph_app.astream(initial_state):
        for node_name, state_update in output.items():
            if "logs" in state_update:
                for log in state_update["logs"]:
                    await manager.broadcast(json.dumps({
                        "type": "log",
                        "data": log.dict()
                    }))
            
            # If there's a reschedule plan, broadcast it
            if "reschedule_plan" in state_update:
                await manager.broadcast(json.dumps({
                    "type": "reschedule_plan",
                    "data": state_update["reschedule_plan"]
                }))

            if "severity" in state_update:
                await manager.broadcast(json.dumps({
                    "type": "severity",
                    "data": state_update["severity"]
                }))
                
            if "announcements" in state_update:
                serialized_anns = [ann.dict() if hasattr(ann, 'dict') else ann for ann in state_update["announcements"]]
                # Add to our local audit logs
                ANNOUNCEMENTS_LOG.extend(serialized_anns)
                save_announcements()
                
                await manager.broadcast(json.dumps({
                    "type": "announcements",
                    "data": serialized_anns
                }))
                
            if "incident_explanation" in state_update:
                await manager.broadcast(json.dumps({
                    "type": "incident_explanation",
                    "data": state_update["incident_explanation"]
                }))
                
            # If report is ready
            if "incident_report" in state_update:
                 await manager.broadcast(json.dumps({
                    "type": "report",
                    "data": state_update["incident_report"]
                }))
        
        await asyncio.sleep(0.5) # Slight pause to make the UI look like agents are "thinking"

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection open
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# Serve frontend static files in production if the frontend dist folder exists
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

frontend_dist_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "dist")

if os.path.exists(frontend_dist_path):
    assets_path = os.path.join(frontend_dist_path, "assets")
    if os.path.exists(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

    @app.get("/{catchall:path}")
    async def serve_frontend(catchall: str):
        # Skip API/websocket routes
        if catchall.startswith("api") or catchall.startswith("ws"):
            return {"detail": "Not Found"}
            
        file_path = os.path.join(frontend_dist_path, catchall)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
            
        return FileResponse(os.path.join(frontend_dist_path, "index.html"))

