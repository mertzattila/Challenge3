'use strict';

const express = require('express');
const cors = require('cors');
const { init } = require('./db');

const employeesRouter = require('./routes/employees');
const availabilityRouter = require('./routes/availability');
const groupsRouter = require('./routes/groups');
const scheduleRouter = require('./routes/schedule');
const assignmentsRouter = require('./routes/assignments');
const workHoursRouter = require('./routes/workHours');

init();

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/api/employees', employeesRouter);
app.use('/api/availability', availabilityRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/schedule', scheduleRouter);
app.use('/api/assignments', assignmentsRouter);
app.use('/api/work-hours', workHoursRouter);

// Fallback error handler
app.use((err, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: 'Internal server error', details: String(err) });
});

const PORT = process.env.PORT || 3001;
if (require.main === module) {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`SmartShift API listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
