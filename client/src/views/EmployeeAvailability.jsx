import { useEffect, useState } from 'react';
import { api } from '../api';
import { useStore } from '../useStore';

export default function EmployeeAvailability() {
  const { currentEmployee } = useStore();
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ date: '', startTime: '', endTime: '', isOnCall: false });
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function flash(msg) {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 2500);
  }

  function load() {
    api.getMyAvailability(currentEmployee.id).then(setList).catch(() => {});
  }

  useEffect(() => { load(); }, [currentEmployee.id]);

  function validate() {
    if (!form.date) return 'Please select a date.';
    if (!form.startTime) return 'Please enter a start time.';
    if (!form.endTime) return 'Please enter an end time.';
    if (form.startTime >= form.endTime) return 'End time must be after start time.';
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const err = validate();
    if (err) { setError(err); return; }

    try {
      const payload = {
        employeeId: currentEmployee.id,
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        isOnCall: form.isOnCall,
      };
      if (editId) {
        await api.updateAvailability(editId, payload);
        flash('Availability updated.');
      } else {
        await api.addAvailability(payload);
        flash('Availability added.');
      }
      setForm({ date: '', startTime: '', endTime: '', isOnCall: false });
      setEditId(null);
      load();
    } catch (ex) {
      setError(ex.message);
    }
  }

  function startEdit(row) {
    setEditId(row.id);
    setForm({
      date: row.date,
      startTime: row.startTime,
      endTime: row.endTime,
      isOnCall: !!row.isOnCall,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(id) {
    if (!confirm('Remove this availability slot?')) return;
    try {
      await api.deleteAvailability(id);
      flash('Slot removed.');
      load();
    } catch (ex) {
      setError(ex.message);
    }
  }

  function cancelEdit() {
    setEditId(null);
    setForm({ date: '', startTime: '', endTime: '', isOnCall: false });
  }

  return (
    <div>
      <h2>My Availability</h2>
      <p className="hint">Enter the dates and times when you are available to work.</p>

      <div className="card">
        <h3>{editId ? 'Edit Slot' : 'Add Availability'}</h3>
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
        <form onSubmit={handleSubmit} className="form-grid">
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
            <span>From</span>
            <input
              type="time"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              required
            />
          </label>
          <label className="field">
            <span>Until</span>
            <input
              type="time"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              required
            />
          </label>
          <label className="field field-checkbox">
            <input
              type="checkbox"
              checked={form.isOnCall}
              onChange={(e) => setForm({ ...form, isOnCall: e.target.checked })}
            />
            <span>On-call (available for last-minute assignments)</span>
          </label>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              {editId ? 'Save Changes' : 'Add Slot'}
            </button>
            {editId && (
              <button type="button" className="btn btn-ghost" onClick={cancelEdit}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {list.length === 0 ? (
        <p className="hint" style={{ marginTop: '1.5rem' }}>No availability entered yet.</p>
      ) : (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h3>Your Slots</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>From</th>
                <th>Until</th>
                <th>On-call</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((row) => (
                <tr key={row.id} className={editId === row.id ? 'row-editing' : ''}>
                  <td>{row.date}</td>
                  <td>{row.startTime}</td>
                  <td>{row.endTime}</td>
                  <td>{row.isOnCall ? <span className="badge badge-oncall">On-call</span> : '—'}</td>
                  <td className="row-actions">
                    <button className="btn btn-sm btn-ghost" onClick={() => startEdit(row)}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(row.id)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
