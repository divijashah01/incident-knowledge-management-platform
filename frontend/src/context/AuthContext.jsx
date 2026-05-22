import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session on app load
  useEffect(() => {
    api.get('/auth/me/')
      .then(r => setUser(r.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (username, password) => {
    const r = await api.post('/auth/login/', { username, password });
    setUser(r.data.user);
    return r.data.user;
  };

  const logout = async () => {
    await api.post('/auth/logout/');
    setUser(null);
  };

  const isRole = (...roles) => user && roles.includes(user.role);
  const isAdmin    = () => isRole('admin');
  const isEngineer = () => isRole('admin', 'engineer');
  const isReporter = () => isRole('admin', 'engineer', 'reporter');

  return (
    <AuthContext.Provider value={{
      user, loading,
      login, logout,
      isAdmin, isEngineer, isReporter,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);