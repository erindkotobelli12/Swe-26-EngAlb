import json
from datetime import date

TODAY = date(2026, 10, 14)
STALE_AFTER_DAYS = 7  # assumption: ask Erjon

def check_case(case):
    flags = []
    age = (TODAY - date.fromisoformat(case["last_update"])).days
    if age > STALE_AFTER_DAYS:
        flags.append(f"STALE: last update {age} days ago")
    for field in ("project", "manager"):
        if not case[field]:
            flags.append(f"MISSING: {field}")
    return flags

if __name__ == "__main__":
    for c in json.load(open("data/cases.json")):
        print(c["id"], c["employee"], c["status"], check_case(c))
