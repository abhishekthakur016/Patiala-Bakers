import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api/client.js';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api.get('/auth/me').then(({ data }) => setUser(data.user)).catch(() => setUser(null)).finally(() => setReady(true));
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    setUser(data.user);
    return data.user;
  }, []);
  const register = useCallback(async (body) => {
    const { data } = await api.post('/auth/register', body);
    setUser(data.user);
    return data.user;
  }, []);
  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {});
    setUser(null);
  }, []);

  const can = useCallback((perm) => Boolean(user?.role === 'staff' && user.permissions?.includes(perm)), [user]);

  return <Ctx.Provider value={{ user, ready, login, register, logout, setUser, can, isStaff: user?.role === 'staff' }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
