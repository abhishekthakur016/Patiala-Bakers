import { useState } from 'react';
import toast from 'react-hot-toast';
import { Download } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, apiError } from '../../api/client.js';
import { useFetch } from '../../hooks/useFetch.js';
import { Badge, ErrorState, Skeleton } from '../../components/ui.jsx';
import { cn, downloadText, fmtDate, money, money0 } from '../../utils/format.js';

const RANGES = [['7d', '7 days'], ['30d', '30 days'], ['90d', '90 days'], ['365d', '12 months']];
const AXIS = { fontSize: 11, fill: '#6E5A60' };
const tipStyle = { borderRadius: 10, border: '1px solid #E6D8C3', fontSize: 12 };

function Delta({ cur, prev }) {
  if (!prev) return <span className="text-xs muted">No prior data</span>;
  const p = ((cur - prev) / prev) * 100;
  return <span className={cn('text-xs font-bold', p >= 0 ? 'text-ok' : 'text-bad')}>{p >= 0 ? '+' : '−'}{Math.abs(p).toFixed(1)}% vs previous period</span>;
}

export default function Reports() {
  const [range, setRange] = useState('30d');
  const { data: d, error, reload } = useFetch('/admin/reports', { range });
  const exportCsv = async () => {
    try { const { data: csv } = await api.get('/admin/orders/export.csv', { params: { from: d.from, to: d.to }, responseType: 'text' }); downloadText(`orders-${d.from}-to-${d.to}.csv`, csv); } catch (e) { toast.error(apiError(e).message); }
  };
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const weekly = range === '365d' || range === '90d';
  const series = !d ? [] : weekly ? d.series.reduce((acc, r, i) => { const k = Math.floor(i / 7); acc[k] = acc[k] || { date: r.date, revenue: 0, orders: 0 }; acc[k].revenue += r.revenue; acc[k].orders += r.orders; return acc; }, []) : d.series;
  const maxCat = d ? Math.max(1, ...d.categories.map((c) => c.revenue)) : 1;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="seggrp">{RANGES.map(([k, l]) => <button key={k} className={cn('seg', range === k && 'on')} onClick={() => setRange(k)}>{l}</button>)}</div>
        {d && <span className="text-sm muted">{fmtDate(d.from, 'd MMM yyyy')} – {fmtDate(d.to, 'd MMM yyyy')} · by pickup date</span>}
        <span className="flex-1" />
        <button className="btn btn-o btn-sm" disabled={!d} onClick={exportCsv}><Download size={15} /> Export orders CSV</button>
      </div>
      {!d ? <Skeleton className="h-[520px]" /> : (
        <>
          <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr))]">
            <div className="kpi"><span className="l">Revenue</span><span className="v">{money0(d.totals.revenue)}</span><Delta cur={d.totals.revenue} prev={d.previous.revenue} /></div>
            <div className="kpi"><span className="l">Orders</span><span className="v">{d.totals.orders}</span><Delta cur={d.totals.orders} prev={d.previous.orders} /></div>
            <div className="kpi"><span className="l">Average order</span><span className="v">{money(d.totals.avgOrder)}</span><Delta cur={d.totals.avgOrder} prev={d.previous.avgOrder} /></div>
            <div className="kpi"><span className="l">Collected payments</span><span className="v">{money0(d.totals.collected)}</span><span className="text-xs muted">{d.totals.revenue ? Math.round((d.totals.collected / d.totals.revenue) * 100) : 0}% of revenue</span></div>
            <div className="kpi"><span className="l">Outstanding now</span><span className="v">{money0(d.outstanding.due)}</span><span className="text-xs muted">{d.outstanding.count} active orders</span></div>
          </div>
          <div className="card">
            <div className="card-h"><h3 className="flex-1">Revenue {weekly ? 'by week' : 'by day'}</h3></div>
            <div className="card-b h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ left: 0, right: 8, top: 8 }}>
                  <defs><linearGradient id="rv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6E1630" stopOpacity={0.25} /><stop offset="1" stopColor="#6E1630" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid stroke="#E5D9C7" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={AXIS} tickFormatter={(v) => fmtDate(v, 'd MMM')} minTickGap={24} />
                  <YAxis tick={AXIS} tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} width={52} />
                  <Tooltip contentStyle={tipStyle} labelFormatter={(v) => (weekly ? `Week of ${fmtDate(v)}` : fmtDate(v, 'EEE d MMM'))} formatter={(v, n) => (n === 'revenue' ? [money(v), 'Revenue'] : [v, 'Orders'])} />
                  <Area type="monotone" dataKey="revenue" stroke="#6E1630" strokeWidth={2.5} fill="url(#rv)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(420px,100%),1fr))]">
            <div className="card">
              <div className="card-h"><h3>Revenue by category</h3></div>
              <div className="card-b flex flex-col gap-3.5">
                {d.categories.map((c) => (
                  <div key={c.category} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline gap-2.5 text-[13.5px]"><b className="flex-1">{c.name}</b><span className="muted">{c.qty} items</span><b className="num">{money0(c.revenue)}</b></div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-[#F1E8DB]"><div className="h-full rounded-full bg-wine" style={{ width: `${(c.revenue / maxCat) * 100}%` }} /></div>
                  </div>
                ))}
                {!d.categories.length && <p className="text-sm muted">No sales in this period.</p>}
              </div>
            </div>
            <div className="card">
              <div className="card-h"><h3>Orders {weekly ? 'per week' : 'per day'}</h3></div>
              <div className="card-b h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={series}><CartesianGrid stroke="#E5D9C7" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tick={AXIS} tickFormatter={(v) => fmtDate(v, 'd MMM')} minTickGap={24} /><YAxis tick={AXIS} allowDecimals={false} width={32} /><Tooltip contentStyle={tipStyle} labelFormatter={(v) => fmtDate(v)} formatter={(v) => [v, 'Orders']} /><Bar dataKey="orders" fill="#B8893B" radius={[4, 4, 0, 0]} isAnimationActive={false} /></BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(420px,100%),1fr))]">
            <div className="card">
              <div className="card-h"><h3>Bestsellers</h3></div>
              <div className="card-b !pt-3"><div className="tblwrap"><table className="tbl"><thead><tr><th>#</th><th>Product</th><th>Sold</th><th>Revenue</th></tr></thead><tbody>{d.bestsellers.map((b, i) => <tr key={b.name}><td className="muted">{i + 1}</td><td className="font-semibold">{b.name}</td><td className="num">{b.qty}</td><td className="num font-bold">{money(b.revenue)}</td></tr>)}</tbody></table></div></div>
            </div>
            <div className="card">
              <div className="card-h"><h3>Payments & channels</h3></div>
              <div className="card-b flex flex-col gap-4">
                <div>{d.payments.map((p) => <div key={p.status} className="sumline"><span><Badge>{p.status}</Badge> <span className="ml-1 text-xs muted">{p.count} orders</span></span><b className="num">{money(p.total)}</b></div>)}</div>
                <div className="border-t border-line-2 pt-3">{d.sources.map((s) => <div key={s.source} className="sumline"><span>{s.source}</span><span className="num"><span className="mr-3 text-xs muted">{s.orders} orders</span><b>{money(s.revenue)}</b></span></div>)}</div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
