from fastapi.testclient import TestClient
from main import app
from datetime import datetime, timezone, timedelta
from retention import (
    retention_store,
    RetentionStatus,
    create_record,
    get_records,
    get_record,
    transition,
    AUDIT_LOG_CHAIN,
    load_retention_store
)

client = TestClient(app)

def setup_function():
    # Re-seed retention store before test
    retention_store._seed_initial_data()
    AUDIT_LOG_CHAIN.clear()

# --- Standalone Function Unit Tests ---

def test_standalone_create_record():
    rec = create_record(
        entity_type="announcement",
        content_ref={"test": 123},
        actor="station_master",
        reason="Manual creation"
    )
    assert rec.id is not None
    assert rec.status == RetentionStatus.ACTIVE
    assert rec.content_ref == {"test": 123}
    assert len(AUDIT_LOG_CHAIN) >= 1
    assert AUDIT_LOG_CHAIN[-1].agent == "Retention"
    print("[PASS] test_standalone_create_record")

def test_standalone_get_records_and_get_record():
    records = get_records()
    assert len(records) >= 5
    first_id = records[0].id
    single = get_record(first_id)
    assert single is not None
    assert single.id == first_id

    archived = get_records(status="archived")
    for r in archived:
        assert r.status == RetentionStatus.ARCHIVED
    print("[PASS] test_standalone_get_records_and_get_record")

def test_standalone_transition_state_machine():
    # 1. active -> archived
    rec = create_record(entity_type="train_schedule", content_ref={"sched": 1})
    rec = transition(rec.id, "archived", actor="station_master", reason="Archiving")
    assert rec.status == RetentionStatus.ARCHIVED

    # 2. archived -> active
    rec = transition(rec.id, "active", actor="station_master", reason="Restoring")
    assert rec.status == RetentionStatus.ACTIVE

    # 3. active -> pending_deletion
    rec = transition(rec.id, "pending_deletion", actor="station_master", reason="Pending deletion")
    assert rec.status == RetentionStatus.PENDING_DELETION
    assert rec.scheduled_purge_at is not None

    # 4. pending_deletion -> active (cancel deletion)
    rec = transition(rec.id, "active", actor="station_master", reason="Cancelled")
    assert rec.status == RetentionStatus.ACTIVE
    assert rec.scheduled_purge_at is None

    # 5. active -> pending_deletion -> deleted
    rec = transition(rec.id, "pending_deletion", actor="station_master", reason="Queue for deletion")
    # Manually set scheduled_purge_at in the past to simulate time passed
    past_time = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    rec.scheduled_purge_at = past_time
    retention_store.save()

    rec = transition(rec.id, "deleted", actor="controller", reason="Purge executed")
    assert rec.status == RetentionStatus.DELETED
    assert rec.purged_at is not None
    assert rec.purged_by == "controller"
    assert rec.content_ref is None  # Tombstoned
    print("[PASS] test_standalone_transition_state_machine")

def test_standalone_transition_premature_delete_raises():
    rec = create_record(entity_type="cctv_log", content_ref={"video": "url"})
    rec = transition(rec.id, "pending_deletion", actor="station_master")
    # Future purge date is set by default (+30 days)
    try:
        transition(rec.id, "deleted", actor="controller")
        assert False, "Should have raised ValueError for premature delete"
    except ValueError as e:
        assert "has not passed yet" in str(e)
    print("[PASS] test_standalone_transition_premature_delete_raises")

def test_standalone_invalid_transition_raises():
    rec = create_record(entity_type="incident_report")
    # active cannot go straight to deleted
    try:
        transition(rec.id, "deleted", actor="controller")
        assert False, "Should have raised ValueError for invalid state transition"
    except ValueError as e:
        assert "Invalid transition" in str(e)
    print("[PASS] test_standalone_invalid_transition_raises")

# --- API Integration Tests ---

def test_api_get_retention_records():
    res = client.get("/api/retention/records")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 5
    print("[PASS] test_api_get_retention_records")

def test_api_archive_record_as_station_master():
    res = client.post(
        "/api/retention/archive/rec-ann-101",
        headers={"X-Role": "station_master"},
        json={"reason": "Test archive by station master"}
    )
    assert res.status_code == 200, f"Error: {res.text}"
    record = res.json()
    assert record["status"] == "archived"
    assert record["status_changed_by"] == "station_master"
    print("[PASS] test_api_archive_record_as_station_master")

def test_api_archive_record_as_viewer_forbidden():
    res = client.post(
        "/api/retention/archive/rec-ann-101",
        headers={"X-Role": "viewer"},
        json={"reason": "Viewer trying to archive"}
    )
    assert res.status_code == 403
    print("[PASS] test_api_archive_record_as_viewer_forbidden")

def test_api_approve_delete_controller_only():
    # rec-tel-303 is pending_deletion and purge date is in the past in initial seed data
    res1 = client.post(
        "/api/retention/approve-delete/rec-tel-303",
        headers={"X-Role": "station_master"},
        json={"reason": "Station master trying to approve deletion"}
    )
    assert res1.status_code == 403

    res2 = client.post(
        "/api/retention/approve-delete/rec-tel-303",
        headers={"X-Role": "controller"},
        json={"reason": "Controller confirmed deletion"}
    )
    assert res2.status_code == 200
    record = res2.json()
    assert record["status"] == "deleted"
    assert record["purged_at"] is not None
    assert record["purged_by"] == "controller"
    assert record["content_ref"] is None
    print("[PASS] test_api_approve_delete_controller_only")

if __name__ == "__main__":
    setup_function()
    test_standalone_create_record()
    test_standalone_get_records_and_get_record()
    test_standalone_transition_state_machine()
    test_standalone_transition_premature_delete_raises()
    test_standalone_invalid_transition_raises()
    test_api_get_retention_records()
    test_api_archive_record_as_station_master()
    test_api_archive_record_as_viewer_forbidden()
    test_api_approve_delete_controller_only()
    print("\n===========================================")
    print(" ALL STANDALONE & API RETENTION TESTS PASSED ")
    print("===========================================")
