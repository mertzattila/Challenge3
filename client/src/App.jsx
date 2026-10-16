import { useEffect, useState } from 'react';

/**
 * Scaffold landing page for Person B to build on.
 * It pings the backend health endpoint and lists seeded employees so the
 * client<->server proxy is verified. Replace with the real role switcher
 * and views (tasks B1, B4–B7).
 */
export default function App() {
  const [health, setHealth] = useState('checking...');
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setHealth(d.ok ? 'ok' : 'not ok'))
      .catch(() => setHealth('unreachable (is the server running on :3001?)'));

    fetch('/api/employees')
      .then((r) => r.json())
      .then(setEmployees)
      .catch(() => setEmployees([]));
  }, []);

  return (
    <main className="container">
      <h1>SmartShift</h1>
      <p className="subtitle">Smart employee scheduling — scaffold</p>

      <section className="card">
        <h2>Backend status</h2>
        <p>
          API health: <strong>{health}</strong>
        </p>
        <h3>Seeded employees</h3>
        {employees.length === 0 ? (
          <p>No employees loaded yet.</p>
        ) : (
          <ul>
            {employees.map((e) => (
              <li key={e.id}>
                #{e.id} — {e.name}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="hint">
        Person B: build the role switcher and views here. See SPECIFICATION.md section 7B.
      </p>
    </main>
  );
}
