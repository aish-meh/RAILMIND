import os
import json
import uuid
from enum import Enum
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field

# Import create_log from agents
try:
    from agents import create_log
    from models import AgentLog
except ImportError:
    # Standalone fallback if imported independently
    class AgentLog(BaseModel):
        agent: str
        timestamp: str
        message: str
        details: Optional[Dict[str, Any]] = None

    def create_log(agent: str, message: str, details: Dict[str, Any] = None) -> AgentLog:
        return AgentLog(
            agent=agent,
            timestamp=datetime.now().strftime("%H:%M:%S"),
            message=message,
            details=details or {}
        )


class RetentionStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"
    PENDING_DELETION = "pending_deletion"
    DELETED = "deleted"


class RetentionRole(str, Enum):
    VIEWER = "viewer"
    STATION_MASTER = "station_master"
    CONTROLLER = "controller"


class RetentionRecord(BaseModel):
    id: str
    entity_type: str
    status: RetentionStatus
    created_at: str
    status_changed_at: Optional[str] = None
    status_changed_by: Optional[str] = None
    reason: Optional[str] = None
    scheduled_purge_at: Optional[str] = None
    purged_at: Optional[str] = None
    purged_by: Optional[str] = None
    content_ref: Optional[Any] = None


class RetentionAuditEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    record_id: str
    action: str
    previous_status: Optional[str] = None
    new_status: str
    performed_by: str
    reason: Optional[str] = None
    timestamp: str


class ReasonPayload(BaseModel):
    reason: Optional[str] = None


# Allowed state machine transitions
# active <-> archived
# active -> pending_deletion
# archived -> pending_deletion
# pending_deletion -> active
# pending_deletion -> deleted (only if scheduled_purge_at has passed)
ALLOWED_TRANSITIONS = {
    RetentionStatus.ACTIVE: {RetentionStatus.ARCHIVED, RetentionStatus.PENDING_DELETION},
    RetentionStatus.ARCHIVED: {RetentionStatus.ACTIVE, RetentionStatus.PENDING_DELETION},
    RetentionStatus.PENDING_DELETION: {RetentionStatus.ACTIVE, RetentionStatus.DELETED},
    RetentionStatus.DELETED: set(),  # Terminal state
}

RETENTION_STORE_FILE = os.path.join(os.path.dirname(__file__), "retention_store.json")

# In-memory storage matching announcements_log.json persistence pattern
RETENTION_RECORDS: Dict[str, RetentionRecord] = {}
RETENTION_AUDIT_TRAIL: Dict[str, List[RetentionAuditEntry]] = {}
AUDIT_LOG_CHAIN: List[AgentLog] = []


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def future_iso(days: int = 30) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


def parse_iso_datetime(dt_str: str) -> datetime:
    """Parses ISO timestamp supporting UTC 'Z' or offset."""
    if dt_str.endswith("Z"):
        dt_str = dt_str[:-1] + "+00:00"
    return datetime.fromisoformat(dt_str)


def load_retention_store():
    """Load records and audit trail from JSON file persistence store."""
    global RETENTION_RECORDS, RETENTION_AUDIT_TRAIL
    if os.path.exists(RETENTION_STORE_FILE):
        try:
            with open(RETENTION_STORE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                RETENTION_RECORDS = {
                    k: RetentionRecord(**v)
                    for k, v in data.get("records", {}).items()
                }
                RETENTION_AUDIT_TRAIL = {
                    k: [RetentionAuditEntry(**entry) for entry in v]
                    for k, v in data.get("audit_trails", {}).items()
                }
        except Exception as e:
            print(f"Error loading retention store: {e}, seeding defaults.")
            _seed_initial_data()
    else:
        _seed_initial_data()


def save_retention_store():
    """Save records and audit trail to JSON file persistence store."""
    try:
        data = {
            "records": {k: v.dict() for k, v in RETENTION_RECORDS.items()},
            "audit_trails": {
                k: [entry.dict() for entry in v]
                for k, v in RETENTION_AUDIT_TRAIL.items()
            },
        }
        with open(RETENTION_STORE_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error saving retention store: {e}")


def _seed_initial_data():
    global RETENTION_RECORDS, RETENTION_AUDIT_TRAIL
    sample_records = [
        RetentionRecord(
            id="rec-ann-101",
            entity_type="announcement",
            status=RetentionStatus.ACTIVE,
            created_at="2026-08-20T10:00:00Z",
            status_changed_at="2026-08-20T10:00:00Z",
            status_changed_by="system",
            reason="Initial creation from public address broadcast",
            content_ref={"announcement_id": "ann-101", "train": "22436"},
        ),
        RetentionRecord(
            id="rec-rep-202",
            entity_type="incident_report",
            status=RetentionStatus.ARCHIVED,
            created_at="2026-08-15T14:30:00Z",
            status_changed_at="2026-08-18T09:15:00Z",
            status_changed_by="station_master",
            reason="Incident investigation completed; archived for compliance",
            content_ref={"report_id": "rep-202"},
        ),
        RetentionRecord(
            id="rec-tel-303",
            entity_type="signal_telemetry",
            status=RetentionStatus.PENDING_DELETION,
            created_at="2026-07-01T00:00:00Z",
            status_changed_at="2026-08-21T08:00:00Z",
            status_changed_by="station_master",
            reason="Exceeded 45-day active telemetry retention limit",
            scheduled_purge_at="2026-08-21T08:00:00Z",  # Purge date already reached for testing deletion
            content_ref={"telemetry_batch": "batch-303"},
        ),
        RetentionRecord(
            id="rec-cctv-404",
            entity_type="cctv_log",
            status=RetentionStatus.DELETED,
            created_at="2026-06-10T11:20:00Z",
            status_changed_at="2026-08-10T16:00:00Z",
            status_changed_by="controller",
            reason="Routine quarterly purge approved",
            scheduled_purge_at="2026-08-10T00:00:00Z",
            purged_at="2026-08-10T16:00:00Z",
            purged_by="controller",
            content_ref=None,  # Tombstoned
        ),
        RetentionRecord(
            id="rec-sched-505",
            entity_type="train_schedule",
            status=RetentionStatus.ACTIVE,
            created_at="2026-08-22T06:00:00Z",
            status_changed_at="2026-08-22T06:00:00Z",
            status_changed_by="controller",
            reason="Active daily operations timetable",
            content_ref={"schedule_id": "sched-505"},
        ),
    ]

    RETENTION_RECORDS = {}
    RETENTION_AUDIT_TRAIL = {}

    for record in sample_records:
        RETENTION_RECORDS[record.id] = record
        RETENTION_AUDIT_TRAIL[record.id] = [
            RetentionAuditEntry(
                record_id=record.id,
                action="create",
                previous_status=None,
                new_status=RetentionStatus.ACTIVE.value,
                performed_by=record.status_changed_by or "system",
                reason=record.reason or "Record initialized",
                timestamp=record.created_at,
            )
        ]
        if record.status != RetentionStatus.ACTIVE:
            RETENTION_AUDIT_TRAIL[record.id].append(
                RetentionAuditEntry(
                    record_id=record.id,
                    action=record.status.value,
                    previous_status=RetentionStatus.ACTIVE.value,
                    new_status=record.status.value,
                    performed_by=record.status_changed_by or "system",
                    reason=record.reason,
                    timestamp=record.status_changed_at or record.created_at,
                )
            )
    save_retention_store()


# --- Core Module Functions ---

def create_record(
    entity_type: str,
    content_ref: Optional[Any] = None,
    actor: str = "system",
    reason: Optional[str] = None,
    record_id: Optional[str] = None,
    scheduled_purge_at: Optional[str] = None
) -> RetentionRecord:
    """
    Creates a new active retention record and initial audit trail log.
    """
    rec_id = record_id or f"rec-{entity_type[:3]}-{uuid.uuid4().hex[:6]}"
    timestamp = now_iso()

    record = RetentionRecord(
        id=rec_id,
        entity_type=entity_type,
        status=RetentionStatus.ACTIVE,
        created_at=timestamp,
        status_changed_at=timestamp,
        status_changed_by=actor,
        reason=reason or f"Created new {entity_type} retention record",
        scheduled_purge_at=scheduled_purge_at,
        content_ref=content_ref
    )

    RETENTION_RECORDS[record.id] = record

    audit_entry = RetentionAuditEntry(
        record_id=record.id,
        action="create",
        previous_status=None,
        new_status=RetentionStatus.ACTIVE.value,
        performed_by=actor,
        reason=record.reason,
        timestamp=timestamp
    )
    if record.id not in RETENTION_AUDIT_TRAIL:
        RETENTION_AUDIT_TRAIL[record.id] = []
    RETENTION_AUDIT_TRAIL[record.id].append(audit_entry)

    log_event = create_log(
        agent="Retention",
        message=f"Created record '{record.id}' for entity '{entity_type}'.",
        details={
            "record_id": record.id,
            "action": "create",
            "actor": actor,
            "entity_type": entity_type
        }
    )
    AUDIT_LOG_CHAIN.append(log_event)

    save_retention_store()
    return record


def get_records(
    status: Optional[str] = None,
    entity_type: Optional[str] = None
) -> List[RetentionRecord]:
    """
    Retrieves filtered retention records.
    """
    results = list(RETENTION_RECORDS.values())
    if status:
        stat_val = status.value.lower() if isinstance(status, RetentionStatus) else status.lower()
        results = [
            r for r in results 
            if (r.status.value.lower() if isinstance(r.status, RetentionStatus) else str(r.status).lower()) == stat_val
        ]
    if entity_type:
        results = [r for r in results if r.entity_type.lower() == entity_type.lower()]
    return results


def get_record(record_id: str) -> Optional[RetentionRecord]:
    """
    Retrieves a single retention record by its ID.
    """
    return RETENTION_RECORDS.get(record_id)


def get_audit_trail(record_id: str) -> List[RetentionAuditEntry]:
    """
    Retrieves the audit trail events for a given record ID.
    """
    return RETENTION_AUDIT_TRAIL.get(record_id, [])


def transition(
    record_id: str,
    new_status: str,
    actor: str,
    reason: Optional[str] = None
) -> RetentionRecord:
    """
    Executes a status transition adhering to the retention state machine:
      - active <-> archived
      - active -> pending_deletion
      - archived -> pending_deletion
      - pending_deletion -> active
      - pending_deletion -> deleted (only if scheduled_purge_at has passed)
    
    Tombstones deleted records: keeps row, sets content_ref = None, purged_at = now, purged_by = actor.
    Appends audit trail entry and calls create_log(agent="Retention", ...).
    """
    record = get_record(record_id)
    if not record:
        raise KeyError(f"Retention record '{record_id}' not found.")

    current_status = RetentionStatus(record.status)
    try:
        target_status = RetentionStatus(new_status)
    except ValueError:
        raise ValueError(f"Invalid target status '{new_status}'. Valid statuses: {[s.value for s in RetentionStatus]}")

    # Validate state machine transition
    allowed = ALLOWED_TRANSITIONS.get(current_status, set())
    if target_status not in allowed:
        raise ValueError(
            f"Invalid transition from '{current_status.value}' to '{target_status.value}'. "
            f"Allowed transitions from '{current_status.value}': {[s.value for s in allowed]}"
        )

    now = datetime.now(timezone.utc)
    timestamp = now.isoformat()

    # Rule: deleted only allowed if scheduled_purge_at has passed
    if target_status == RetentionStatus.DELETED:
        if not record.scheduled_purge_at:
            raise ValueError(f"Cannot delete record '{record_id}': no scheduled_purge_at date set.")
        
        purge_dt = parse_iso_datetime(record.scheduled_purge_at)
        if now < purge_dt:
            raise ValueError(
                f"Cannot delete record '{record_id}': scheduled_purge_at ({record.scheduled_purge_at}) has not passed yet."
            )

        # Tombstone the record: keep the row, null out content_ref
        record.content_ref = None
        record.purged_at = timestamp
        record.purged_by = actor

    elif target_status == RetentionStatus.PENDING_DELETION:
        if not record.scheduled_purge_at:
            record.scheduled_purge_at = (now + timedelta(days=30)).isoformat()

    elif target_status == RetentionStatus.ACTIVE:
        record.scheduled_purge_at = None

    prev_status_str = current_status.value
    record.status = target_status
    record.status_changed_at = timestamp
    record.status_changed_by = actor
    if reason is not None:
        record.reason = reason

    RETENTION_RECORDS[record.id] = record

    # Append to immutable audit trail
    audit_entry = RetentionAuditEntry(
        record_id=record.id,
        action=f"transition_{target_status.value}",
        previous_status=prev_status_str,
        new_status=target_status.value,
        performed_by=actor,
        reason=reason,
        timestamp=timestamp,
    )
    if record.id not in RETENTION_AUDIT_TRAIL:
        RETENTION_AUDIT_TRAIL[record.id] = []
    RETENTION_AUDIT_TRAIL[record.id].append(audit_entry)

    # Call create_log and update AUDIT_LOG_CHAIN
    log_event = create_log(
        agent="Retention",
        message=f"Transitioned record '{record.id}' from '{prev_status_str}' to '{target_status.value}' by {actor}.",
        details={
            "record_id": record.id,
            "action": f"transition_{prev_status_str}_to_{target_status.value}",
            "actor": actor,
            "previous_status": prev_status_str,
            "new_status": target_status.value,
            "reason": reason
        }
    )
    AUDIT_LOG_CHAIN.append(log_event)

    save_retention_store()
    return record


# Compatibility Class for existing store object references
class RetentionStore:
    def __init__(self):
        load_retention_store()

    @property
    def records(self):
        return RETENTION_RECORDS

    @property
    def audit_trails(self):
        return RETENTION_AUDIT_TRAIL

    def get_records(self, status=None, entity_type=None):
        return get_records(status=status, entity_type=entity_type)

    def get_record(self, record_id: str):
        return get_record(record_id)

    def get_audit_trail(self, record_id: str):
        return get_audit_trail(record_id)

    def record_transition(self, record, new_status, action, performed_by, reason=None, scheduled_purge_at=None, purged=False):
        # Bridge to transition()
        if scheduled_purge_at and not record.scheduled_purge_at:
            record.scheduled_purge_at = scheduled_purge_at
        return transition(
            record_id=record.id,
            new_status=new_status.value if isinstance(new_status, RetentionStatus) else new_status,
            actor=performed_by,
            reason=reason
        )

    def _seed_initial_data(self):
        _seed_initial_data()

    def load(self):
        load_retention_store()

    def save(self):
        save_retention_store()


retention_store = RetentionStore()

# Load on module import
load_retention_store()
