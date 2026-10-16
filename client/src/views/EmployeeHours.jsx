import { useEffect, useState } from 'react';
import { api } from '../api';
import { useStore } from '../useStore';

export default function EmployeeHours() {
  const { currentEmployee } = useStore();
  const [history, setHistory] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [form, setForm] = useState({ groupId: '', date: '', hours: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function flash(msg) {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 2500);
  }

  function load() {
    api.getMyHours(currentEmployee.id).then(setHistory).catch(() => {});
    api.getMyAssignments(currentEmployee.id).then(setAssignments).catch(() => {});
  }

  useEffect(() => { load(); }, [currentEmployee.id]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.date) { setError('Please select a date.'); return; }
    if (!form.hours || isNaN(Number(form.hours)) || Number(form.hours) <= 0) {
      setError('Please enter a valid number of hours.');
      return;
    }
    try {
      await api.submitHours({
        employeeId: currentEmployee.id,
        groupId: form.groupId || null,
        date: form.date,
        hours: Number(form.hours),
      });
      flash('Hours submitted.');
      setForm({ groupId: '', date: '', hours: '' });
      load();
    } catch (ex) {
      setError(ex.message);
    }
  }

  const totalHours = history.reduce((sum, r) => sum + Number(r.hours), 0);

  return (
    <div>
      <h2>Work Hours</h2>
      <p className="hint">Record the hours you actually worked after completing an assignment.</p>

      <div className="card">
        <h3>Submit Hours</h3>
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
        <form onSubmit={handleSubmit} className="form-grid">
          <label className="field">
            <span>Assignment (optional)</span>
            <select
              className="select"
              value={form.groupId}
              onChange={(e) => {
                const a = assignments.find((x) => String(x.groupId) === e.target.value);
                setForm({
                  ...form,
                  groupId: e.target.value,
                  date: a ? a.date : form.date,
                });
              }}
            >
              <option value="">— Select group —</option>
              {assignments.map((a) => (
                <option key={a.groupId} value={a.groupId}>
                  {a.name} ({a.date})
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Date</span>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
            />
          </label>
          <label className="field">
            <span>Hours worked</span>
            <input
              type="number"
              min="0.1"
              step="0.1"
              placeholder="e.g. 3.5"
              value={form.hours}
              onChange={(e) => setForm({ ...form, hours: e.target.value })}
              required
            />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">Submit</button>
          </div>
        </form>
      </div>

      {history.length > 0 && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <div className="card-header-row">
            <h3>Work History</h3>
            <span className="stat-chip">Total: <strong>{totalHours.toFixed(1)} h</strong></span>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Group</th>
                <th>Hours</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => {
                const a = assignments.find((x) => x.groupId === r.groupId);
                return (
                  <tr key={r.id}>
                    <td>{r.date}</td>
                    <td>{a ? a.name : r.groupId ? `Group #${r.groupId}` : '—'}</td>
                    <td>{r.hours}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {history.length === 0 && (
        <p className="hint" style={{ marginTop: '1.5rem' }}>No hours recorded yet.</p>
      )}
    </div>
  );
}
