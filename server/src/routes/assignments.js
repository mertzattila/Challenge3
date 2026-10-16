'use strict';

const express = require('express');
const { db } = require('../db');

const router = express.Router();

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
  const status = empId ? 'assigned' : 'unassigned';

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
  });
});

module.exports = router;
