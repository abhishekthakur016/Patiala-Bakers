import { useCallback, useEffect, useRef, useState } from 'react';
import { api, apiError } from '../api/client.js';

// Small data-loading hook: GET `url` with `params`, re-runs when the serialised params change.
export function useFetch(url, params) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(params || {});
  const seq = useRef(0);

  const load = useCallback(async ({ silent } = {}) => {
    if (!url) return;
    const n = ++seq.current;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const { data: d } = await api.get(url, { params: JSON.parse(key) });
      if (n === seq.current) setData(d);
    } catch (e) {
      if (n === seq.current) setError(apiError(e).message);
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, [url, key]);

  useEffect(() => { load(); }, [load]);
  return { data, error, loading, reload: load, setData };
}
