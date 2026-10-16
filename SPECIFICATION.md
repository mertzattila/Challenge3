# SmartShift — INEC Challenge 3 Specification

> Full-stack smart employee scheduling system. This document is the single source of truth
> for both teammates. Person A (backend APIs) and Person B (frontend + scheduler module)
> both build against the shared API contract in section 4.

---

## 1. Problem Statement
A small company runs scheduled group activities, each needing a host (employee). The manager
currently imports a group schedule from Excel, collects availability by hand, and manually
assigns hosts — this does not scale. Build a full-stack web app that automates assignment with
an intelligent scheduler, supports Employee and Manager roles with privacy separation, tracks
worked hours, and is usable by a non-technical person. Functional prototype; simulated accounts
and locally stored data are acceptable.

## 2. Tech Stack (decided)
- **Frontend:** React + Vite. Lightweight styling (plain CSS / utility classes), no heavy UI library.
- **Backend:** Node + Express, single process.
- **DB:** SQLite via Node's built-in `node:sqlite` (`DatabaseSync`) — file-based, zero-config,
  no native build step (better-sqlite3 fails to compile on Node v26). Persistent across role switches.
- **Excel import:** parse pasted TSV/CSV directly; optional `.xlsx` via `xlsx` library if time allows.
- **Auth:** Simulated login / role switcher (no passwords). Employee picks identity; Manager has a
  manager view. Current role + employee id is the access boundary.
- **Scheduler:** optimization-based (scoring + local search / limited backtracking) that balances
  total expected working hours, as a pure, testable module.
- **Tests:** Vitest (or Jest) for the scheduler module; manual/endpoint tests for APIs.

## 3. Data Model (SQLite)
| Table | Columns |
|-------|---------|
> **DB note:** we use Node's built-in `node:sqlite` (`DatabaseSync`), not better-sqlite3, because
> better-sqlite3's native addon does not compile on Node v26. The prepared-statement API is the same
> (`.prepare().run/get/all`); the one difference is transactions — use the exported `transaction(fn)`
> helper from `server/src/db.js` instead of `db.transaction(...)`.

| `employees` | id, name |
| `availability` | id, employee_id, date, start_time, end_time, is_on_call |
| `groups` | id, name, date, start_time, end_time, duration_hours |
| `assignments` | id, group_id, employee_id (nullable), status (`assigned`\|`unassigned`), manually_overridden (bool) |
| `work_hours` | id, employee_id, group_id (nullable), date, hours |

## 4. Shared API Contract
**Both build against this. Agree once; do not change unilaterally.**

| Method | Path | Body / Query | Returns |
|--------|------|--------------|---------|
| GET  | `/api/health` | — | `{ ok: true }` |
| GET  | `/api/employees` | — | `[{id, name}]` |
| GET  | `/api/availability` | `?employeeId=` | `[{id, employeeId, date, startTime, endTime, isOnCall}]` |
| POST | `/api/availability` | `{employeeId, date, startTime, endTime, isOnCall}` | created row |
| PUT  | `/api/availability/:id` | `{date, startTime, endTime, isOnCall}` | updated row |
| DELETE | `/api/availability/:id` | — | `{ ok: true }` |
| GET  | `/api/availability/all` | (manager) | availability grouped by employee |
| POST | `/api/groups/import` | `{rows}` (TSV/CSV text or parsed array of name,date,start,end) | `[{id, name, date, startTime, endTime, durationHours}]` |
| POST | `/api/schedule/generate` | — | `{assignments:[{groupId, employeeId, status, manuallyOverridden}], unassigned:[groupId...]}` |
| PUT  | `/api/assignments/:id` | `{employeeId}` (override) | updated assignment |
| GET  | `/api/assignments/mine` | `?employeeId=` | `[{groupId, employeeId, status, ...group fields}]` |
| POST | `/api/work-hours` | `{employeeId, groupId, date, hours}` | created row |
| GET  | `/api/work-hours/mine` | `?employeeId=` | `[{id, employeeId, groupId, date, hours}]` |
| GET  | `/api/work-hours/all` | (manager) | all work-hour rows |

### Scheduler module signature (Person B owns)
Lives at `/server/scheduler/generateSchedule.js`:

```js
// generateSchedule({ employees, availability, groups }) -> { assignments, unassigned }
//   employees:    [{ id, name }]
//   availability: [{ id, employeeId, date, startTime, endTime, isOnCall }]
//   groups:       [{ id, name, date, startTime, endTime, durationHours }]
//   returns:
//     assignments: [{ groupId, employeeId, status: 'assigned', manuallyOverridden: false }]
//     unassigned:  [groupId, ...]
module.exports = function generateSchedule({ employees, availability, groups }) { /* ... */ };
```

Person A calls it from `POST /api/schedule/generate`. **Person A starts with a trivial greedy STUB**
(already included at `/server/scheduler/generateSchedule.js`) so A is not blocked; swap in B's real
module at integration.

## 5. Scheduling Algorithm Rules
- **Rule 1 — Availability (HARD):** assign only within declared availability; never make an employee
  host more than two overlapping groups at once.
- **Rule 2 — Fairness (SOFT):** fairness score = assigned hours ÷ available-day count (normalize by
  how often available); optimizer minimizes the spread/variance of normalized loads so
  rarely-available employees aren't loaded like always-available ones.
- **Rule 3 — Four-hour preference (SOFT):** same-day groups starting <4h apart → prefer SAME employee
  if they can cover both; >4h apart → prefer DIFFERENT employees when feasible. Preferences never
  override hard rules.
- **Rule 4 — Unassignable (HARD):** if no valid employee, mark the group `unassigned`.
- **Rule 5 — Manager control:** manager can override any assignment; overrides are flagged and
  preserved on regeneration.
- **Approach:** greedy seed (hardest-to-fill groups first) + local-search / limited-backtracking
  improvement pass minimizing cost = fairness spread + preference penalties.

## 6. Privacy
Employee-scoped endpoints return ONLY the current employee's own data (availability, assignments,
work hours). Only the manager role reaches aggregate `/all` endpoints. Simulated auth: current role +
employee id is the access boundary.

## 7. Task Tracks

### 7A. PERSON A — Backend APIs (branch `backend`)
- [ ] **A1** Scaffold `/server`, SQLite schema + DB init, `GET /api/health`, seed employees, `GET /api/employees`.
  Test: health ok, tables exist, employees returns seeds.
- [ ] **A2** Availability API — `GET/POST/PUT/DELETE /api/availability` scoped by `employeeId`;
  `GET /api/availability/all` (manager). Enforce employee-only access to own rows.
  Test: CRUD works; employee B cannot read A's rows via scoped endpoint.
- [ ] **A3** Group import API — `POST /api/groups/import` parsing pasted TSV/CSV (name,date,start,end),
  compute durationHours, clear errors on malformed rows; optional `.xlsx` via `xlsx`.
  Test: valid import persists; malformed returns helpful error.
- [ ] **A4** Schedule generate endpoint — `POST /api/schedule/generate` loads data, calls B's
  `generateSchedule(...)` (use trivial greedy STUB until merge), persists assignments, marks unassigned.
  Test: returns assignments + unassigned for seeded data.
- [ ] **A5** Override API — `PUT /api/assignments/:id` reassign, flag `manuallyOverridden`, preserve
  overrides on regenerate. Test: override persists through a regenerate call.
- [ ] **A6** Assignments + work-hours API — `GET /api/assignments/mine`, `POST /api/work-hours`,
  `GET /api/work-hours/mine`, `GET /api/work-hours/all`. Scope employee endpoints by identity;
  manager-only for `/all`. Test: employee submits + reads own hours; B can't read A's; manager reads all;
  data persists across requests.

### 7B. PERSON B — Frontend + Scheduler module (branch `frontend`)
- [ ] **B1** Scaffold `/client` + mock API layer returning contract shapes so UI builds without backend.
  Role landing screen: pick Manager or Employee by name; store current role/identity.
  Test: switching role/identity changes view + header.
- [ ] **B2** Scheduler module (pure) `/server/scheduler/generateSchedule.js` — hard rules first
  (availability match + no-more-than-two-overlapping; mark unassignable). Vitest unit tests on synthetic data.
- [ ] **B3** Scheduler optimization — normalized fairness + local-search/backtracking to minimize load
  spread + four-hour same/different soft preference. Unit tests: fairer distribution for uneven
  availability; same-day <4h groups prefer one employee when feasible. Push module for A.
- [ ] **B4** Availability UI — form (date + time interval), list with edit/delete, on-call toggle.
  Wire to `/api/availability` (mock then real).
- [ ] **B5** Manager views — all-employee availability overview + on-call summary; group import UI
  (paste/upload) with parsed preview before save. Wire to `/api/availability/all` and `/api/groups/import`.
- [ ] **B6** Schedule + override UI — Generate button, results table with unassigned clearly styled,
  manager reassign dropdown → `PUT /api/assignments/:id`, overrides visibly marked.
- [ ] **B7** Employee schedule + work-hours UI — employee sees own assignments, submits actual hours,
  views own history; manager sees all hours; confirm persistence across role switches.

## 8. Final Integration (TOGETHER, last ~10 min)
Merge `backend` + `frontend` into `main`. Swap A's stub scheduler for B's real module. Replace
frontend mocks with real API calls. Walk the demo flow: enter/modify availability → import bookings →
generate + explain → show privacy + hour tracking. Fix contract mismatches. Confirm no console errors
and that records survive view switches.

**Bonus if ahead:** workload stats panel, conflict-detection warning on override, on-call last-minute
prioritization, external-booking POST endpoint.

## 9. The 5 Explanation Points (present at demo)
1. **Why a website:** no install, cross-device, natural fit for spreadsheet import + quick availability
   edits; shared backend = one consistent source of truth that persists across role switches.
2. **How the scheduler works:** hard constraints (availability + no triple overlap) filter candidates;
   optimizer scores to balance normalized workload and applies the four-hour preference; unassignable
   groups flagged; manager can override.
3. **How privacy is handled:** employee endpoints scoped to current identity, never return others' data;
   only manager reaches aggregate endpoints.
4. **How fairness is measured:** workload normalized by availability frequency (assigned hours ÷
   available days); optimizer minimizes the spread of normalized loads so rarely-available employees
   aren't overloaded.
5. **How it extends:** swappable scheduler module, replaceable auth, import seam ready for external
   booking integration, on-call data already modeled for last-minute scheduling.

## Git Workflow
- Person A pushes spec/scaffold to `main`, adds B as collaborator (collaborator invite handled on GitHub).
- A on branch `backend`, B on branch `frontend`. Push often. Merge both to `main` at integration.
- `/client` and `/server` are separate npm projects so installs don't collide.
- No force-push without asking.

### How Person B starts
```bash
git clone https://github.com/mertzattila/Challenge3.git
cd Challenge3
git checkout -b frontend
cd client && npm install && npm run dev
```
