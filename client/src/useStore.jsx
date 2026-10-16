/**
 * Global app state via React context.
 * role: 'manager' | 'employee'
 * currentEmployee: { id, name } | null
 * employees: [{ id, name }]
 */
import { createContext, useContext, useState } from 'react';

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [role, setRole] = useState(null); // null = not logged in
  const [currentEmployee, setCurrentEmployee] = useState(null);
  const [employees, setEmployees] = useState([]);

  function login(roleChoice, employee = null) {
    setRole(roleChoice);
    setCurrentEmployee(employee);
  }

  function logout() {
    setRole(null);
    setCurrentEmployee(null);
  }

  return (
    <StoreContext.Provider
      value={{ role, currentEmployee, employees, setEmployees, login, logout }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  return useContext(StoreContext);
}
