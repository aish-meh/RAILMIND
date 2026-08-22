from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class Station(BaseModel):
    id: str
    name: str
    code: str

class Train(BaseModel):
    id: str
    name: str
    number: str
    route: List[str]  # List of station codes
    schedule: Dict[str, str]  # Station code to arrival time (HH:MM format)
    current_station: Optional[str] = None
    status: str = "On Time"

class DelayEvent(BaseModel):
    train_id: str
    station_code: str
    delay_minutes: int
    reason: str

class AgentLog(BaseModel):
    agent: str
    timestamp: str
    message: str
    details: Optional[Dict[str, Any]] = None

class Announcement(BaseModel):
    train_id: str
    train_name: str
    train_number: str
    station_code: str
    station_name: str
    delay_minutes: int
    new_time: str
    text_en: str
    text_hi: str
    text_ta: str
    text_ja: str
    severity: str
    timestamp: str

# LangGraph State
from typing import TypedDict, Annotated
import operator

class GraphState(TypedDict):
    delay_event: Optional[DelayEvent]
    train: Optional[Train]
    affected_trains: List[Train]
    reschedule_plan: Dict[str, Dict[str, str]] # train_id -> {station_code: new_time}
    notifications: List[Dict[str, Any]]
    passenger_impact: int
    financial_cost: int
    incident_report: Optional[str]
    severity: str # "Critical", "Major", "Minor"
    announcements: List[Announcement]
    incident_explanation: Optional[str]
    logs: Annotated[List[AgentLog], operator.add]

from retention import RetentionStatus, RetentionRole, RetentionRecord, RetentionAuditEntry, ReasonPayload

