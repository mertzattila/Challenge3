import { useState } from 'react';
import { api } from '../api';

const EXAMPLE = `Group A,2026-11-01,09:00,11:00
Group B,2026-11-01,13:00,15:30
Group C,2026-11-02,10:00,12:00
Group D,2026-11-02,14:00,16:00`;

export default function ManagerImport() {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState([]);
  const [parseError, setParseError] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function parseCSV(raw) {
    const rows = [];
    const errors = [];
    raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((line, i) => {
        // Support both comma and tab-separated
        const parts = line.includes('\t') ? line.split('\t') : line.split(',');
        if (parts.length < 4) {
          errors.push(`Row ${i + 1}: expected 4 columns (name, date, start, end), got ${parts.length}.`);
          return;
        }
        const [name, date, startTime, endTime] = parts.map((p) => p.trim());
        if (!name || !date || !startTime || !endTime) {
          errors.push(`Row ${i + 1}: blank field.`);
          return;
        }
        // Validate date
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          errors.push(`Row ${i + 1}: date must be YYYY-MM-DD, got "${date}".`);
          return;
        }
        rows.push({ name, date, startTime, endTime });
      });
    return { rows, errors };
  }

  function handleParse() {
    setParseError('');
    setSaved(false);
    setSuccess('');
    const { rows, errors } = parseCSV(text);
    if (errors.length > 0) {
      setParseError(errors.join('\n'));
      setPreview([]);
      return;
    }
    if (rows.length === 0) {
      setParseError('No valid rows found.');
      setPreview([]);
      return;
    }
    setPreview(rows);
  }

  async function handleImport() {
    setError('');
    try {
      await api.importGroups(preview);
      setSuccess(`${preview.length} group(s) imported successfully.`);
      setSaved(true);
      setText('');
      setPreview([]);
    } catch (ex) {
      setError(ex.message);
    }
  }

  return (
    <div>
      <h2>Import Group Schedule</h2>
      <p className="hint">
        Paste your schedule data below. Each row: <code>Group name, YYYY-MM-DD, HH:MM, HH:MM</code>
        <br />
        Comma-separated or tab-separated (Excel paste) are both accepted.
      </p>

      <div className="card">
        <div className="card-header-row">
          <h3>Paste Data</h3>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setText(EXAMPLE); setPreview([]); setSaved(false); }}
          >
            Load example
          </button>
        </div>

        <textarea
          className="textarea"
          rows={8}
          placeholder={'Group A,2026-11-01,09:00,11:00\nGroup B,2026-11-01,13:00,15:30'}
          value={text}
          onChange={(e) => { setText(e.target.value); setPreview([]); setSaved(false); }}
        />

        {parseError && (
          <div className="alert alert-error" style={{ whiteSpace: 'pre-line' }}>
            {parseError}
          </div>
        )}

        <div className="form-actions" style={{ marginTop: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={handleParse} disabled={!text.trim()}>
            Preview
          </button>
        </div>
      </div>

      {preview.length > 0 && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h3>Preview ({preview.length} rows)</h3>
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}
          <table className="table">
            <thead>
              <tr>
                <th>Group Name</th>
                <th>Date</th>
                <th>Start</th>
                <th>End</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((r, i) => (
                <tr key={i}>
                  <td>{r.name}</td>
                  <td>{r.date}</td>
                  <td>{r.startTime}</td>
                  <td>{r.endTime}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!saved && (
            <div className="form-actions">
              <button className="btn btn-primary" onClick={handleImport}>
                Import {preview.length} Group(s)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
