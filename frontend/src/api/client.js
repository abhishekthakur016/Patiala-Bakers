import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  timeout: 20000,
});

// Normalises API errors into { message, fields, issues, status }
export function apiError(err) {
  const d = err?.response?.data || {};
  return {
    status: err?.response?.status || 0,
    message: d.error || (err?.code === 'ECONNABORTED' ? 'The request timed out. Please try again.' : err?.response ? 'Something went wrong.' : 'Cannot reach the server. Check your connection.'),
    fields: d.fields || {},
    issues: d.issues || [],
  };
}

const ASSET = import.meta.env.VITE_ASSET_URL || '';
export const assetUrl = (u) => (!u ? '' : /^(https?:|data:|blob:)/.test(u) || u.startsWith('/images/') ? u : `${ASSET}${u}`);
