'use strict';

const express = require('express');
const { db } = require('../db');

const router = express.Router();

function rowToDto(r) {
  return {
    id: r.id,
    employeeId: r.employee_id,
    groupId: r.group_id,
    date: r.date,
    hours: r.hours,
  };
}

// GET /api/work-hours/all  (MANAGER) -> every work-hour row, with employee name.
// Declared before '/mine' route group — distinct paths, order not critical, but explicit.
router.get('/all', (req, res) => {
  const rows = db
    .prepare(
      `SELECT w.*, e.name AS employee_name
         FROM work_hours w
         JOIN employees e ON e.id = w.employee_id
        ORDER BY w.date, w.employee_id`
    )
    .all();
  res.json(
    rows.map((r) => ({ ...rowToDto(r), employeeName: r.employee_name }))
  );
});

// GET /api/work-hours/mine?employeeId=  -> only this employee's records (privacy)
router.get('/mine', (req, res) => {
  const employeeId = Number(req.query.employeeId);
  if (!employeeId) {
    return res.status(400).json({ error: 'employeeId query parameter is required' });
  }
  const rows = db
    .prepare('SELECT * FROM work_hours WHERE employee_id = ? ORDER BY date')
    .all(employeeId);
  res.json(rows.map(rowToDto));
});

// POST /api/work-hours  {employeeId, groupId, date, hours}
router.post('/', (req, res) => {
  const { employeeId, groupId, date, hours } = req.body || {};
  if (!employeeId || !date || hours === undefined || hours === null) {
    return res.status(400).json({ error: 'employeeId, date and hours are required' });
  }
  const h = Number(hours);
  if (Number.isNaN(h) || h < 0) {
    return res.status(400).json({ error: 'hours must be a non-negative number' });
  }
  const info = db
    .prepare('INSERT INTO work_hours (employee_id, group_id, date, hours) VALUES (?,?,?,?)')
    .run(employeeId, groupId ?? null, date, h);
  const row = db.prepare('SELECT * FROM work_hours WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(rowToDto(row));
});

module.exports = router;
