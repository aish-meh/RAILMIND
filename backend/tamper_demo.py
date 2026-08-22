import sys
import json
import os

STORE_FILE = os.path.join(os.path.dirname(__file__), "retention_store.json")

def tamper(record_id):
    if not os.path.exists(STORE_FILE):
        print(f"Store file {STORE_FILE} not found.")
        return

    with open(STORE_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    audit_trails = data.get("audit_trails", {})
    if record_id not in audit_trails:
        print(f"Record {record_id} not found in audit trails.")
        return

    trail = audit_trails[record_id]
    if len(trail) > 1:
        entry = trail[1]
        reason = entry.get("reason", "")
        if not reason.endswith(" [TAMPERED]"):
            entry["reason"] = reason + " [TAMPERED]"
            
            with open(STORE_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"Successfully tampered record {record_id}.")
        else:
            print(f"Record {record_id} is already tampered.")
    else:
        print(f"Record {record_id} does not have a second entry to tamper.")

def restore(record_id):
    if not os.path.exists(STORE_FILE):
        print(f"Store file {STORE_FILE} not found.")
        return

    with open(STORE_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    audit_trails = data.get("audit_trails", {})
    if record_id not in audit_trails:
        print(f"Record {record_id} not found in audit trails.")
        return

    trail = audit_trails[record_id]
    restored = False
    for entry in trail:
        reason = entry.get("reason", "")
        if reason.endswith(" [TAMPERED]"):
            entry["reason"] = reason[:-11]
            restored = True
            
    if restored:
        with open(STORE_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"Successfully restored record {record_id}.")
    else:
        print(f"Record {record_id} did not need restoring.")

if __name__ == '__main__':
    if len(sys.argv) < 3 or sys.argv[1] not in ('tamper', 'restore') or sys.argv[2] != '--record-id' or len(sys.argv) < 4:
        print('Usage: python tamper_demo.py tamper|restore --record-id <id>')
        sys.exit(1)
    
    action = sys.argv[1]
    record_id = sys.argv[3]
    
    if action == 'tamper':
        tamper(record_id)
    else:
        restore(record_id)
