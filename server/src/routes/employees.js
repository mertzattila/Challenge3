'use strict';

const express = require('express');
const { db } = require('../db');

const router = express.Router();

// GET /api/employees -> [{id, name}]
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT id, name FROM employees ORDER BY id').all();
  res.json(rows);
});

module.exports = router;
