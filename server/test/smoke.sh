#!/usr/bin/env bash
# SmartShift backend smoke test. Start the server first (npm start), then run:
#   bash test/smoke.sh
# Exits non-zero on the first failed assertion.
set -euo pipefail

BASE="${BASE:-http://localhost:3001}"
pass=0

check() {
  local label="$1" expected="$2" actual="$3"
  if echo "$actual" | grep -q "$expected"; then
    echo "  PASS: $label"
    pass=$((pass+1))
  else
    echo "  FAIL: $label"
    echo "    expected to contain: $expected"
    echo "    got: $actual"
    exit 1
  fi
}

echo "== health =="
check "health ok" '"ok":true' "$(curl -s $BASE/api/health)"

echo "== employees =="
check "seeded employees" 'Alice' "$(curl -s $BASE/api/employees)"

echo "== availability CRUD + privacy =="
A=$(curl -s -X POST $BASE/api/availability -H 'Content-Type: application/json' \
  -d '{"employeeId":1,"date":"2026-10-20","startTime":"09:00","endTime":"18:00","isOnCall":false}')
check "create availability" '"employeeId":1' "$A"
curl -s -X POST $BASE/api/availability -H 'Content-Type: application/json' \
  -d '{"employeeId":2,"date":"2026-10-20","startTime":"08:00","endTime":"20:00","isOnCall":true}' >/dev/null
check "privacy: unknown employee sees nothing" '^\[\]$' "$(curl -s "$BASE/api/availability?employeeId=99")"
check "validation: bad window rejected" 'must be' \
  "$(curl -s -X POST $BASE/api/availability -H 'Content-Type: application/json' -d '{"employeeId":1,"date":"bad","startTime":"09:00","endTime":"10:00"}')"

echo "== on-call summary =="
check "on-call lists Bob" 'Bob' "$(curl -s $BASE/api/availability/on-call)"

echo "== group import =="
check "import groups" 'Yoga' \
  "$(curl -s -X POST $BASE/api/groups/import -H 'Content-Type: application/json' \
     -d '{"rows":"name\tdate\tstart\tend\nYoga\t2026-10-20\t10:00\t11:30\nSpin\t2026-10-20\t12:00\t13:00\nLate\t2026-10-20\t19:00\t20:00"}')"
check "malformed import error" 'YYYY-MM-DD' \
  "$(curl -s -X POST $BASE/api/groups/import -H 'Content-Type: application/json' -d '{"rows":"Bad\t20-10-2026\t10:00\t11:00"}')"

echo "== schedule generate =="
check "generate returns assignments" 'assignments' "$(curl -s -X POST $BASE/api/schedule/generate)"

echo "== stats =="
check "stats has fairnessSpread" 'fairnessSpread' "$(curl -s $BASE/api/schedule/stats)"

echo "== override + conflict warning =="
# Override Yoga (assignment ids depend on run) — grab Alice's first assignment id.
AID=$(curl -s "$BASE/api/assignments/mine?employeeId=1" | grep -o '"assignmentId":[0-9]*' | head -1 | grep -o '[0-9]*')
if [ -n "${AID:-}" ]; then
  check "override persists" 'manuallyOverridden":true' \
    "$(curl -s -X PUT $BASE/api/assignments/$AID -H 'Content-Type: application/json' -d '{"employeeId":4}')"
  check "override survives regenerate" 'manuallyOverridden":true' "$(curl -s -X POST $BASE/api/schedule/generate)"
fi

echo "== work-hours + privacy =="
check "submit hours" '"hours":1.5' \
  "$(curl -s -X POST $BASE/api/work-hours -H 'Content-Type: application/json' -d '{"employeeId":1,"groupId":1,"date":"2026-10-20","hours":1.5}')"
check "manager sees all hours" 'employeeName' "$(curl -s $BASE/api/work-hours/all)"

echo ""
echo "ALL $pass CHECKS PASSED"
