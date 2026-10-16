'use strict';

const express = require('express');
const { db, transaction } = require('../db');
const generateSchedule = require('../../scheduler/generateSchedule');

const router = express.Router();

function loadInputs() {
  const employees = db.prepare('SELECT id, name FROM employees ORDER BY id').all();
  const availability = db
    .prepare('SELECT * FROM availability')
    .all()
    .map((a) => ({
      id: a.id,
      employeeId: a.employee_id,
      date: a.date,
      startTime: a.start_time,
      endTime: a.end_time,
      isOnCall: !!a.is_on_call,
    }));
  const groups = db
    .prepare('SELECT * FROM groups ORDER BY date, start_time')
    .all()
    .map((g) => ({
      id: g.id,
      name: g.name,
      date: g.date,
      startTime: g.start_time,
      endTime: g.end_time,
      durationHours: g.duration_hours,
    }));
  return { employees, availability, groups };
}

// POST /api/schedule/generate
// Regenerates assignments but PRESERVES manual overrides (Rule 5).
router.post('/generate', (req, res) => {
  const { employees, availability, groups } = loadInputs();

  // Preserve manual overrides: keep their group out of the auto run.
  const overrides = db
    .prepare("SELECT * FROM assignments WHERE manually_overridden = 1 AND status = 'assigned'")
    .all();
  const overriddenGroupIds = new Set(overrides.map((o) => o.group_id));

  const groupsForAuto = groups.filter((g) => !overriddenGroupIds.has(g.id));

  let result;
  try {
    result = generateSchedule({ employees, availability, groups: groupsForAuto });
  } catch (err) {
    return res.status(500).json({ error: 'Scheduler failed', details: String(err) });
  }

  // Persist: wipe non-overridden assignments, then insert the fresh ones.
  const insert = db.prepare(
    'INSERT INTO assignments (group_id, employee_id, status, manually_overridden) VALUES (?,?,?,?)'
  );
  const tx = transaction(() => {
    db.prepare('DELETE FROM assignments WHERE manually_overridden = 0').run();
    for (const a of result.assignments) {
      insert.run(a.groupId, a.employeeId, 'assigned', 0);
    }
    for (const gid of result.unassigned) {
      insert.run(gid, null, 'unassigned', 0);
    }
  });
  tx();

  // Return the full current picture (auto + preserved overrides).
  const all = db.prepare('SELECT * FROM assignments').all();
  const assignments = all
    .filter((a) => a.status === 'assigned')
    .map((a) => ({
      assignmentId: a.id,
      groupId: a.group_id,
      employeeId: a.employee_id,
      status: a.status,
      manuallyOverridden: !!a.manually_overridden,
    }));
  const unassigned = all.filter((a) => a.status === 'unassigned').map((a) => a.group_id);

  res.json({ assignments, unassigned });
});

// GET /api/schedule/stats  (MANAGER)
// Workload statistics per employee: assigned groups, scheduled hours (from group
// durations), submitted actual hours, available-day count, and a normalized
// fairness load (scheduled hours / available days). Great for demonstrating Rule 2.
router.get('/stats', (req, res) => {
  const employees = db.prepare('SELECT id, name FROM employees ORDER BY id').all();

  const stats = employees.map((e) => {
    const assigned = db
      .prepare(
        `SELECT g.duration_hours AS dur
           FROM assignments a
           JOIN groups g ON g.id = a.group_id
          WHERE a.employee_id = ? AND a.status = 'assigned'`
      )
      .all(e.id);

    const assignedGroups = assigned.length;
    const scheduledHours = assigned.reduce((sum, r) => sum + r.dur, 0);

    const submittedHours =
      db
        .prepare('SELECT COALESCE(SUM(hours),0) AS h FROM work_hours WHERE employee_id = ?')
        .get(e.id).h || 0;

    const availableDays =
      db
        .prepare('SELECT COUNT(DISTINCT date) AS c FROM availability WHERE employee_id = ?')
        .get(e.id).c || 0;

    // Normalized fairness load: scheduled hours per available day.
    // Null when the employee has no availability (not comparable).
    const normalizedLoad =
      availableDays > 0 ? Number((scheduledHours / availableDays).toFixed(2)) : null;

    return {
      employeeId: e.id,
      name: e.name,
      assignedGroups,
      scheduledHours: Number(scheduledHours.toFixed(2)),
      submittedHours: Number(submittedHours.toFixed(2)),
      availableDays,
      normalizedLoad,
    };
  });

  // Spread of normalized loads (lower = fairer). Useful headline metric for the demo.
  const loads = stats.map((s) => s.normalizedLoad).filter((n) => n !== null);
  const spread =
    loads.length > 1 ? Number((Math.max(...loads) - Math.min(...loads)).toFixed(2)) : 0;

  res.json({ perEmployee: stats, fairnessSpread: spread });
});

module.exports = router;
