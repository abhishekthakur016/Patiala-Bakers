import { format, parseISO } from 'date-fns';

export const money = (n, currency = 'AUD') =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency, minimumFractionDigits: 2 }).format(Number(n) || 0);
export const money0 = (n) => `$${Math.round(Number(n) || 0).toLocaleString('en-AU')}`;

export const t12 = (h) => {
  if (!h) return '';
  const [a, b] = h.split(':').map(Number);
  return `${a % 12 || 12}${b ? `:${String(b).padStart(2, '0')}` : ''} ${a >= 12 ? 'pm' : 'am'}`;
};
export const fmtDate = (s, f = 'EEE d MMM') => (s ? format(parseISO(s), f) : '');
export const fmtLong = (s) => fmtDate(s, 'EEEE d MMMM yyyy');
export const fmtStamp = (d) => (d ? format(new Date(d), 'dd/MM/yyyy HH:mm') : '');
export const fmtShort = (d) => (d ? format(new Date(d), 'd MMM yyyy') : '');

export const todayISO = () => format(new Date(), 'yyyy-MM-dd');
export function relDay(s) {
  const t = todayISO();
  const tm = format(new Date(Date.now() + 86400000), 'yyyy-MM-dd');
  if (s === t) return 'Today';
  if (s === tm) return 'Tomorrow';
  return fmtDate(s);
}

export const sizeLabel = (k) => String(k || '').replace(/"/g, '″');

export const STATUS_CLS = {
  Pending: 'b-gold', Confirmed: 'b-info', 'In Production': 'b-warn', Ready: 'b-ok', Collected: 'b-mute', Cancelled: 'b-bad',
  Paid: 'b-ok', Unpaid: 'b-bad', 'Deposit paid': 'b-warn', Refunded: 'b-mute',
  New: 'b-info', Quoted: 'b-gold', 'Awaiting Payment': 'b-warn', Declined: 'b-mute', Converted: 'b-ok',
  High: 'b-bad', Normal: 'b-mute', Applied: 'b-ok', 'Rolled back': 'b-mute', Scheduled: 'b-info', Failed: 'b-bad',
  'In stock': 'b-ok', 'Low stock': 'b-warn', 'Sold out': 'b-bad', 'Made to order': 'b-info', Unavailable: 'b-mute',
};

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
export const cn = (...a) => a.filter(Boolean).join(' ');

export function downloadText(filename, text, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
