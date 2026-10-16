'use strict';

const express = require('express');
const { db } = require('../db');
const { toMinutes } = require('../validate');

const router = express.Router();

/**
 * Check whether assigning `employeeId` to `group` breaks an availability rule.
 * Returns an array of human-readable warning strings (empty if clean).
 * Non-blocking: the manager is allowed to override anyway (Rule 5), but is warned.
 */
function detectConflicts(employeeId, group) {
  const warnings = [];
  if (!employeeId || !group) return warnings;

  const avail = db
    .prepare('SELECT * FROM availability WHERE employee_id = ? AND date = ?')
    .all(employeeId, group.date);

  const covered = avail.some(
    (a) =>
      toMinutes(a.start_time) <= toMinutes(group.start_time) &&
      toMinutes(a.end_time) >= toMinutes(group.end_time)
  );
  if (!covered) {
    warnings.push(
      `Employee is not available for ${group.name} on ${group.date} ${group.start_time}-${group.end_time}`
    );
  }

  // More than two overlapping groups at once?
  const others = db
    .prepare(
      `SELECT g.* FROM assignments a
         JOIN groups g ON g.id = a.group_id
        WHERE a.employee_id = ? AND a.status = 'assigned' AND g.date = ? AND g.id != ?`
    )
    .all(employeeId, group.date, group.id);
  const overlapping = others.filter(
    (g) =>
      toMinutes(g.start_time) < toMinutes(group.end_time) &&
      toMinutes(group.start_time) < toMinutes(g.end_time)
  );
  if (overlapping.length >= 2) {
    warnings.push(
      `This would make the employee host ${overlapping.length + 1} overlapping groups at once`
    );
  }

  return warnings;
}

// GET /api/assignments/mine?employeeId=  -> that employee's assigned groups only (privacy)
router.get('/mine', (req, res) => {
  const employeeId = Number(req.query.employeeId);
  if (!employeeId) {
    return res.status(400).json({ error: 'employeeId query parameter is required' });
  }
  const rows = db
    .prepare(
      `SELECT a.id AS assignmentId, a.group_id, a.employee_id, a.status, a.manually_overridden,
              g.name, g.date, g.start_time, g.end_time, g.duration_hours
         FROM assignments a
         JOIN groups g ON g.id = a.group_id
        WHERE a.employee_id = ? AND a.status = 'assigned'
        ORDER BY g.date, g.start_time`
    )
    .all(employeeId);

  res.json(
    rows.map((r) => ({
      assignmentId: r.assignmentId,
      groupId: r.group_id,
      employeeId: r.employee_id,
      status: r.status,
      manuallyOverridden: !!r.manually_overridden,
      name: r.name,
      date: r.date,
      startTime: r.start_time,
      endTime: r.end_time,
      durationHours: r.duration_hours,
    }))
  );
});

// PUT /api/assignments/:id  {employeeId}  -> manager override (flagged + preserved on regenerate)
router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const { employeeId } = req.body || {};
  const existing = db.prepare('SELECT * FROM assignments WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'assignment not found' });

  const empId = employeeId === null || employeeId === undefined ? null : Number(employeeId);
  if (empId) {
    const emp = db.prepare('SELECT id FROM employees WHERE id = ?').get(empId);
    if (!emp) return res.status(400).json({ error: `employee ${empId} does not exist` });
  }
  const status = empId ? 'assigned' : 'unassigned';

  // Non-blocking conflict detection (bonus): warn the manager if this override
  // breaks an availability rule, but still allow it (Rule 5 — manager control).
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(existing.group_id);
  const warnings = empId ? detectConflicts(empId, group) : [];

  db.prepare(
    'UPDATE assignments SET employee_id = ?, status = ?, manually_overridden = 1 WHERE id = ?'
  ).run(empId, status, id);

  const row = db.prepare('SELECT * FROM assignments WHERE id = ?').get(id);
  res.json({
    id: row.id,
    groupId: row.group_id,
    employeeId: row.employee_id,
    status: row.status,
    manuallyOverridden: !!row.manually_overridden,
    warnings,
  });
});

module.exports = router;
