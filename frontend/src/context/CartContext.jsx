import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { uid } from '../utils/format.js';
import { useAuth } from './AuthContext.jsx';

// Cart lines hold only ids, choices and quantity. Prices always come from the server via /cart/quote.
const KEY = 'pb-cart-v1';
const Ctx = createContext(null);

const readLocal = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
const writeLocal = (items) => { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* storage unavailable */ } };
const sameLine = (a, b) => a.productId === b.productId && a.variant === b.variant && JSON.stringify(a.options || {}) === JSON.stringify(b.options || {});

export function CartProvider({ children }) {
  const { user, ready } = useAuth();
  const [items, setItems] = useState(readLocal);
  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);
  const [open, setOpen] = useState(false);
  const syncedFor = useRef(null);

  // On sign-in merge the guest cart into the saved account cart
  useEffect(() => {
    if (!ready) return;
    if (user?.role === 'customer' && syncedFor.current !== user.id) {
      syncedFor.current = user.id;
      api.get('/account/cart').then(({ data }) => {
        setItems((local) => {
          const merged = [...data.items];
          for (const l of local) if (!merged.some((m) => sameLine(m, l))) merged.push(l);
          return merged;
        });
      }).catch(() => {});
    }
    if (!user) syncedFor.current = null;
  }, [user, ready]);

  useEffect(() => {
    writeLocal(items);
    if (user?.role === 'customer' && syncedFor.current === user.id) {
      const t = setTimeout(() => api.put('/account/cart', { items }).catch(() => {}), 400);
      return () => clearTimeout(t);
    }
  }, [items, user]);

  // Re-price whenever the cart changes
  useEffect(() => {
    if (!items.length) { setQuote(null); return; }
    let cancelled = false;
    setQuoting(true);
    const t = setTimeout(() => {
      api.post('/cart/quote', { items }).then(({ data }) => { if (!cancelled) setQuote(data); }).catch(() => {}).finally(() => !cancelled && setQuoting(false));
    }, 150);
    return () => { cancelled = true; clearTimeout(t); };
  }, [items]);

  const add = useCallback((line) => {
    setItems((cur) => {
      const ex = cur.find((c) => sameLine(c, line));
      if (ex) return cur.map((c) => (c === ex ? { ...c, qty: Math.min(50, c.qty + line.qty) } : c));
      return [...cur, { ...line, id: uid() }];
    });
  }, []);
  const setQty = useCallback((id, qty) => setItems((cur) => (qty < 1 ? cur.filter((c) => c.id !== id) : cur.map((c) => (c.id === id ? { ...c, qty: Math.min(50, qty) } : c)))), []);
  const update = useCallback((id, patch) => setItems((cur) => cur.map((c) => (c.id === id ? { ...c, ...patch } : c))), []);
  const remove = useCallback((id) => setItems((cur) => cur.filter((c) => c.id !== id)), []);
  const clear = useCallback(() => setItems([]), []);
  const replace = useCallback((next) => setItems(next), []);

  const count = useMemo(() => items.reduce((s, i) => s + i.qty, 0), [items]);
  const lineFor = useCallback((id) => quote?.lines.find((l) => l.id === id), [quote]);
  const issueFor = useCallback((id) => quote?.issues.find((l) => l.id === id), [quote]);

  return (
    <Ctx.Provider value={{ items, quote, quoting, count, add, setQty, update, remove, clear, replace, lineFor, issueFor, open, setOpen }}>
      {children}
    </Ctx.Provider>
  );
}

export const useCart = () => useContext(Ctx);
