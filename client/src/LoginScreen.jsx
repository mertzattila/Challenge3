import { useEffect, useState } from 'react';
import { api } from './api';
import { useStore } from './useStore';

export default function LoginScreen() {
  const { login, setEmployees } = useStore();
  const [employees, setLocal] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getEmployees()
      .then((list) => {
        setLocal(list);
        setEmployees(list);
        if (list.length > 0) setSelectedId(String(list[0].id));
      })
      .catch(() => setError('Cannot reach the server. Make sure the backend is running on :3001.'))
      .finally(() => setLoading(false));
  }, []);

  function handleEmployee() {
    const emp = employees.find((e) => String(e.id) === selectedId);
    if (!emp) return;
    login('employee', emp);
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">📅</div>
        <h1>SmartShift</h1>
        <p className="login-sub">Smart employee scheduling</p>

        {error && <div className="alert alert-error">{error}</div>}
        {loading && <p className="hint">Loading employees…</p>}

        {!loading && !error && (
          <>
            <div className="login-section">
              <h3>Sign in as Manager</h3>
              <button className="btn btn-primary full-width" onClick={() => login('manager', null)}>
                Enter as Manager
              </button>
            </div>

            <div className="divider">or</div>

            <div className="login-section">
              <h3>Sign in as Employee</h3>
              <select
                className="select full-width"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
              <button
                className="btn btn-secondary full-width"
                style={{ marginTop: '0.5rem' }}
                onClick={handleEmployee}
                disabled={!selectedId}
              >
                Enter as Employee
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
