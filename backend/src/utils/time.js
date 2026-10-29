// Date helpers that work in the bakery's configured time zone without extra dependencies.
// Dates are exchanged as 'YYYY-MM-DD' strings and times as 'HH:MM' (24h) strings.

const pad = (n) => String(n).padStart(2, '0');

export function nowParts(timeZone) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const p = Object.fromEntries(f.formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

export const todayIn = (tz) => nowParts(tz).date;

// Minutes on a naive timeline (local wall clock treated as UTC) – good for comparing local times
export function localStamp(date, time = '00:00') {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return Date.UTC(y, m - 1, d, hh, mm) / 60000;
}

export function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function weekday(date) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export const toMinutes = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const fromMinutes = (n) => `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;

export const isDateStr = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
export const isTimeStr = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s || '');

export function dateRange(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
