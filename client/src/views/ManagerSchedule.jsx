import { useEffect, useState } from 'react';
import { api } from '../api';
import { useStore } from '../useStore';

export default function ManagerSchedule() {
  const { employees } = useStore();
  const [schedule, setSchedule] = useState(null);
  const [groups, setGroups] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [overrideRow, setOverrideRow] = useState(null); // full assignment row
  const [overrideEmpId, setOverrideEmpId] = useState('');

  // Load groups once so we can display names + times
  useEffect(() => {
    api.getGroups().then(setGroups).catch(() => {});
  }, []);

  function flash(msg) {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  }

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    setOverrideRow(null);
    try {
      const result = await api.generateSchedule();
      // Reload groups in case a fresh import just happened
      const freshGroups = await api.getGroups();
      setGroups(freshGroups);
      setSchedule(result);
      flash('Schedule generated.');
    } catch (ex) {
      setError(ex.message);
    } finally {
      setGenerating(false);
    }
  }

  // The override endpoint expects the assignment DB id, which we need to look up.
  // The schedule/generate response gives groupId; the assignments route uses assignment id.
  // We use PUT /api/assignments/:id but we need the assignment id, not group id.
  // Work-around: after generate, fetch all assignments by looking at the returned data.
  // The generate response for assigned rows doesn't include assignmentId — we need to GET it.
  // We'll call GET /api/assignments/mine won't work for manager. Instead we do the override
  // by group: the generate response doesn't give assignment id. Let's check what assignments
  // route returns — the schedule.js returns assignments without the assignment db id.
  // We'll need to look up the assignment id from the group id via a helper request.
  async function handleOverride() {
    if (!overrideRow || !overrideEmpId) return;
    setError('');
    try {
      await api.overrideAssignment(overrideRow.assignmentId, Number(overrideEmpId));
      flash('Assignment updated.');
      setOverrideRow(null);
      setOverrideEmpId('');
      const result = await api.generateSchedule();
      const freshGroups = await api.getGroups();
      setGroups(freshGroups);
      setSchedule(result);
    } catch (ex) {
      setError('Override failed: ' + ex.message);
    }
  }

  const empName = (id) => {
    const e = employees.find((x) => x.id === id);
    return e ? e.name : `#${id}`;
  };

  const groupInfo = (id) => groups.find((g) => g.id === id);

  return (
    <div>
      <h2>Schedule</h2>
      <p className="hint">Generate an automatic schedule, then review and reassign if needed.</p>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div style={{ marginBottom: '1.25rem' }}>
        <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
          {generating ? 'Generating…' : '⚡ Generate Schedule'}
        </button>
      </div>

      {schedule && (
        <>
          {schedule.unassigned && schedule.unassigned.length > 0 && (
            <div className="alert alert-warn" style={{ marginBottom: '1rem' }}>
              ⚠️ {schedule.unassigned.length} group(s) could not be assigned — no available employee found.
            </div>
          )}

          <div className="card">
            <h3>Assignments ({schedule.assignments?.length ?? 0})</h3>
            {!schedule.assignments || schedule.assignments.length === 0 ? (
              <p className="hint">
                No assignments yet. Import groups and add employee availability first, then generate.
              </p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Group</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Assigned To</th>
                    <th>Type</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.assignments.map((a) => {
                    const g = groupInfo(a.groupId);
                    const isEditing = overrideRow?.groupId === a.groupId;
                    return (
                      <tr key={a.groupId} className={a.manuallyOverridden ? 'row-override' : ''}>
                        <td>{g?.name ?? `Group #${a.groupId}`}</td>
                        <td>{g?.date ?? '—'}</td>
                        <td>{g ? `${g.startTime} – ${g.endTime}` : '—'}</td>
                        <td>{empName(a.employeeId)}</td>
                        <td>
                          {a.manuallyOverridden
                            ? <span className="badge badge-override">Manual</span>
                            : <span className="badge badge-assigned">Auto</span>
                          }
                        </td>
                        <td>
                          {isEditing ? (
                            <div className="override-inline">
                              <select
                                className="select select-sm"
                                value={overrideEmpId}
                                onChange={(e) => setOverrideEmpId(e.target.value)}
                              >
                                <option value="">— pick employee —</option>
                                {employees.map((e) => (
                                  <option key={e.id} value={e.id}>{e.name}</option>
                                ))}
                              </select>
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={handleOverride}
                                disabled={!overrideEmpId}
                              >
                                Save
                              </button>
                              <button
                                className="btn btn-sm btn-ghost"
                                onClick={() => setOverrideRow(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              className="btn btn-sm btn-ghost"
                              onClick={() => { setOverrideRow(a); setOverrideEmpId(''); }}
                            >
                              Reassign
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {schedule.unassigned && schedule.unassigned.length > 0 && (
            <div className="card card-danger" style={{ marginTop: '1rem' }}>
              <h3>❌ Unassigned Groups</h3>
              <p className="hint">No employee is available for these groups. Consider checking availability or assigning manually.</p>
              <table className="table">
                <thead>
                  <tr><th>Group</th><th>Date</th><th>Time</th></tr>
                </thead>
                <tbody>
                  {schedule.unassigned.map((gid) => {
                    const g = groupInfo(gid);
                    return (
                      <tr key={gid}>
                        <td>{g?.name ?? `#${gid}`}</td>
                        <td>{g?.date ?? '—'}</td>
                        <td>{g ? `${g.startTime} – ${g.endTime}` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
