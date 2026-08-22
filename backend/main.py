import asyncio
from fastapi import FastAPI, BackgroundTasks, WebSocket, WebSocketDisconnect, Header, Query, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
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

# Load announcements and incident reports at startup
import os
ANNOUNCEMENTS_FILE = os.path.join(os.path.dirname(__file__), "announcements_log.json")
INCIDENT_REPORTS_FILE = os.path.join(os.path.dirname(__file__), "incident_reports_log.json")

ANNOUNCEMENTS_LOG: List[dict] = []
INCIDENT_REPORTS: List[dict] = []

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

def load_incident_reports():
    global INCIDENT_REPORTS
    if os.path.exists(INCIDENT_REPORTS_FILE):
        try:
            with open(INCIDENT_REPORTS_FILE, "r", encoding="utf-8") as f:
                INCIDENT_REPORTS = json.load(f)
        except Exception as e:
            print(f"Error loading incident reports: {e}")
            INCIDENT_REPORTS = []
    else:
        INCIDENT_REPORTS = []

def save_incident_reports():
    try:
        with open(INCIDENT_REPORTS_FILE, "w", encoding="utf-8") as f:
            json.dump(INCIDENT_REPORTS, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error saving incident reports: {e}")

load_announcements()
load_incident_reports()

@app.get("/api/initial-state")
async def get_initial_state():
    return {
        "trains": [t.dict() for t in TRAINS],
        "stations": [s.dict() for s in STATIONS]
    }

@app.get("/api/announcements")
async def get_announcements():
    return ANNOUNCEMENTS_LOG

@app.get("/api/incident-reports")
async def get_incident_reports():
    return INCIDENT_REPORTS

@app.post("/api/clear-incident-reports")
async def clear_incident_reports():
    global INCIDENT_REPORTS
    INCIDENT_REPORTS = []
    save_incident_reports()
    return {"status": "Incident reports log cleared"}


# ---------------------------------------------------------------------------
# Retention Policy & Role-Based Access Control
# ---------------------------------------------------------------------------

ROLE_HIERARCHY = {
    "viewer": 1,
    "station_master": 2,
    "controller": 3
}

def require_role(min_role: str):
    """
    FastAPI dependency enforcing viewer < station_master < controller hierarchy.
    Extracts the X-Role header (case-insensitive) and validates permissions.
    """
    def dependency(x_role: Optional[str] = Header(default="viewer", alias="X-Role")) -> str:
        role = (x_role or "viewer").strip().lower()
        if role not in ROLE_HIERARCHY:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid X-Role: '{x_role}'. Allowed roles: {list(ROLE_HIERARCHY.keys())}"
            )
        if ROLE_HIERARCHY[role] < ROLE_HIERARCHY[min_role]:
            raise HTTPException(
                status_code=403,
                detail=f"Forbidden: '{role}' role does not have sufficient permissions. Requires at least '{min_role}'."
            )
        return role
    return dependency

from fastapi import APIRouter, Depends
from retention import create_record, parse_iso_datetime
from datetime import datetime, timezone

retention_router = APIRouter(prefix="/api/retention", tags=["retention"])

@retention_router.get("/records", response_model=List[RetentionRecord])
async def get_retention_records(
    status: Optional[str] = Query(default=None, description="Filter by retention status (active, archived, pending_deletion, deleted)"),
    entity_type: Optional[str] = Query(default=None, description="Filter by entity type"),
    role: str = Depends(require_role("viewer"))
):
    return retention_store.get_records(status=status, entity_type=entity_type)

@retention_router.get("/audit-trail/{record_id}", response_model=List[RetentionAuditEntry])
async def get_retention_audit_trail(
    record_id: str,
    role: str = Depends(require_role("viewer"))
):
    record = retention_store.get_record(record_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Retention record '{record_id}' not found.")
    return retention_store.get_audit_trail(record_id)

@retention_router.post("/archive/{record_id}", response_model=RetentionRecord)
async def archive_retention_record(
    record_id: str,
    payload: Optional[ReasonPayload] = Body(default=None),
    role: str = Depends(require_role("station_master"))
):
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

@retention_router.post("/request-delete/{record_id}", response_model=RetentionRecord)
async def request_delete_retention_record(
    record_id: str,
    payload: Optional[ReasonPayload] = Body(default=None),
    role: str = Depends(require_role("station_master"))
):
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

@retention_router.post("/restore/{record_id}", response_model=RetentionRecord)
async def restore_retention_record(
    record_id: str,
    payload: Optional[ReasonPayload] = Body(default=None),
    role: str = Depends(require_role("station_master"))
):
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

@retention_router.post("/approve-delete/{record_id}", response_model=RetentionRecord)
async def approve_delete_retention_record(
    record_id: str,
    payload: Optional[ReasonPayload] = Body(default=None),
    role: str = Depends(require_role("controller"))
):
    record = retention_store.get_record(record_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Retention record '{record_id}' not found.")

    if not record.scheduled_purge_at:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete record '{record_id}': no scheduled_purge_at date set."
        )

    purge_dt = parse_iso_datetime(record.scheduled_purge_at)
    if datetime.now(timezone.utc) < purge_dt:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete record '{record_id}': scheduled_purge_at ({record.scheduled_purge_at}) has not passed yet."
        )

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

app.include_router(retention_router)




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
                
                # Persist retention record for announcement batch
                create_record(
                    entity_type="announcement",
                    content_ref=serialized_anns,
                    actor="system",
                    reason="Automated announcement batch generated during incident processing"
                )
                
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
                report_content = state_update["incident_report"]
                report_entry = {
                    "id": f"rep-{int(datetime.now(timezone.utc).timestamp())}",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "content": report_content
                }
                INCIDENT_REPORTS.append(report_entry)
                save_incident_reports()
                
                # Persist retention record for incident report
                create_record(
                    entity_type="incident_report",
                    content_ref=report_entry,
                    actor="system",
                    reason="Comprehensive AI incident report generated"
                )
                
                await manager.broadcast(json.dumps({
                    "type": "report",
                    "data": report_content
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


