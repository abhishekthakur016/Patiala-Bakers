import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api/client.js';

const Ctx = createContext(null);

export function SettingsProvider({ children }) {
  const [state, setState] = useState({ settings: null, categories: [], loading: true, error: null });
  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/settings');
      setState({ settings: data.settings, categories: data.categories, loading: false, error: null });
    } catch {
      setState((s) => ({ ...s, loading: false, error: 'Could not load bakery details.' }));
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  return <Ctx.Provider value={{ ...state, reload: load }}>{children}</Ctx.Provider>;
}

export const useSettings = () => useContext(Ctx);
export const useCategoryName = () => {
  const { categories } = useSettings();
  return (id) => categories.find((c) => c.id === id)?.name || id;
};
