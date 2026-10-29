import { useState } from 'react';
import toast from 'react-hot-toast';
import { ChevronDown, FileUp, RotateCcw } from 'lucide-react';
import { api, apiError } from '../../api/client.js';
import { useFetch } from '../../hooks/useFetch.js';
import { Badge, Confirm, Field, Spinner } from '../../components/ui.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { cn, fmtStamp, money, sizeLabel } from '../../utils/format.js';

const blankRule = () => ({ cats: { cakes: true }, sizes: { '7"': true }, dir: 'inc', type: '%', amt: '10', round: '0.5', skipUnavail: true });
const SAMPLE = 'product_id,product_name,variant,price\nblack-forest-gateau,Black Forest Gateau,7",60.00\nmotichoor-ladoo,Motichoor Ladoo,1 kg,31.50';

function Step({ n, title, children }) {
  return <div className="flex gap-3.5 border-b border-line-2 py-[18px] last:border-0"><span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-wine text-[12.5px] font-extrabold text-white">{n}</span><div className="flex min-w-0 flex-1 flex-col gap-2.5"><h4 className="text-sm font-extrabold">{title}</h4>{children}</div></div>;
}
const Pill = ({ on, onChange, children }) => <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full border-[1.5px] border-line bg-white px-3.5 text-[13.5px] font-bold"><input type="checkbox" className="h-4 w-4 accent-wine" checked={!!on} onChange={(e) => onChange(e.target.checked)} />{children}</label>;

function ChangesTable({ rows, excl, setExcl }) {
  return (
    <div className="max-h-[440px] overflow-auto rounded-xl border border-line-2 bg-white">
      <table className="tbl"><thead><tr>{setExcl && <th className="w-8"><span className="sr-only">Include</span></th>}<th>Product</th><th>Option</th><th>Old</th><th>New</th><th>Change</th></tr></thead>
        <tbody>{rows.map((r, i) => {
          const k = `${r.product}|${r.variant}`; const off = excl?.[k] || r.error;
          return (
            <tr key={k + i} className={cn(off && 'opacity-50', r.error && 'bg-[#FFF4F2]')}>
              {setExcl && <td><input type="checkbox" className="h-4 w-4 accent-wine" aria-label={`Include ${r.name} ${r.variant}`} disabled={!!r.error} checked={!off} onChange={(e) => setExcl({ ...excl, [k]: !e.target.checked })} /></td>}
              <td className="font-semibold">{r.name}{r.error && <span className="block text-xs text-bad">{r.error}</span>}</td><td>{sizeLabel(r.variant)}</td>
              <td className="num text-mute line-through">{money(r.oldPrice)}</td><td className="num font-extrabold text-wine">{money(r.newPrice)}</td>
              <td className={cn('num text-xs font-bold', r.newPrice >= r.oldPrice ? 'text-ok' : 'text-bad')}>{r.newPrice >= r.oldPrice ? '+' : '−'}{money(Math.abs(r.newPrice - r.oldPrice))}</td>
            </tr>
          );
        })}</tbody></table>
    </div>
  );
}

export default function Pricing() {
  const { categories } = useSettings();
  const [rule, setRule] = useState(blankRule);
  const [when, setWhen] = useState('now');
  const [runAt, setRunAt] = useState('');
  const [title, setTitle] = useState('');
  const [preview, setPreview] = useState(null);
  const [excl, setExcl] = useState({});
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [openAudit, setOpenAudit] = useState('');
  const [rollback, setRollback] = useState(null);
  const [csv, setCsv] = useState({ text: '', rows: null });
  const audit = useFetch('/admin/pricing/audit');
  const sched = useFetch('/admin/pricing/schedules');

  const setR = (k, v) => { setRule((r) => ({ ...r, [k]: v })); setPreview(null); setAck(false); };
  const body = () => ({ ...rule, amt: Number(rule.amt) });

  const doPreview = async () => {
    setErr(''); setBusy('preview');
    try { const { data } = await api.post('/admin/pricing/preview', body()); setPreview(data); setExcl({}); setAck(false); if (!data.rows.length) setErr('No prices match this rule.'); } catch (e) { setErr(apiError(e).message); } finally { setBusy(''); }
  };
  const included = preview?.rows.filter((r) => !r.error && !excl[`${r.product}|${r.variant}`]) || [];
  const apply = async () => {
    setBusy('apply');
    try {
      if (when === 'schedule') {
        await api.post('/admin/pricing/schedules', { title: title || preview.description, rule: body(), runAt: new Date(runAt).toISOString() });
        toast.success('Price change scheduled'); sched.reload({ silent: true });
      } else {
        const { data } = await api.post('/admin/pricing/apply', { changes: included, description: preview.description, source: 'Bulk Price Manager' });
        toast.success(`${data.audit.changes.length} prices updated · ${data.audit.ref}`); audit.reload({ silent: true });
      }
      setPreview(null); setAck(false);
    } catch (e) { toast.error(apiError(e).message); } finally { setBusy(''); }
  };
  const csvPreview = async () => {
    setBusy('csv');
    try { const { data } = await api.post('/admin/pricing/csv/preview', { csv: csv.text }); setCsv({ ...csv, rows: data.rows }); } catch (e) { toast.error(apiError(e).message); } finally { setBusy(''); }
  };
  const csvApply = async () => {
    const changes = csv.rows.filter((r) => r.status === 'ok').map((r) => ({ product: r.product, variant: r.variant, newPrice: r.newPrice, oldPrice: r.oldPrice, name: r.name }));
    setBusy('csvapply');
    try { const { data } = await api.post('/admin/pricing/apply', { changes, description: `CSV import · ${changes.length} prices`, source: 'CSV import' }); toast.success(`${data.audit.changes.length} prices updated`); setCsv({ text: '', rows: null }); audit.reload({ silent: true }); } catch (e) { toast.error(apiError(e).message); } finally { setBusy(''); }
  };

  return (
    <>
      <div className="grid items-start gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr))]">
        <section className="card card-b">
          <h3 className="font-sans text-base font-extrabold">Bulk price change</h3>
          <Step n="1" title="Which categories?"><div className="flex flex-wrap gap-2">{categories.map((c) => <Pill key={c.id} on={rule.cats[c.id]} onChange={(v) => setR('cats', { ...rule.cats, [c.id]: v })}>{c.name}</Pill>)}</div></Step>
          <Step n="2" title="Which sizes?"><div className="flex flex-wrap gap-2">{['5"', '7"', '9"'].map((s) => <Pill key={s} on={rule.sizes[s]} onChange={(v) => setR('sizes', { ...rule.sizes, [s]: v })}>{sizeLabel(s)} cakes</Pill>)}<Pill on={rule.sizes.other} onChange={(v) => setR('sizes', { ...rule.sizes, other: v })}>All other sizes / weights</Pill></div></Step>
          <Step n="3" title="How much?">
            <div className="flex flex-wrap items-center gap-3">
              <div className="seggrp"><button className={cn('seg', rule.dir === 'inc' && 'on')} onClick={() => setR('dir', 'inc')}>Increase</button><button className={cn('seg', rule.dir === 'dec' && 'on')} onClick={() => setR('dir', 'dec')}>Decrease</button></div>
              <div className="flex max-w-[220px] items-center overflow-hidden rounded-xl border-[1.5px] border-line bg-white">
                {rule.type === '$' && <span className="px-3.5 text-lg font-extrabold text-mute">$</span>}
                <input type="number" min="0" step="0.01" aria-label="Amount" className="min-h-[48px] w-full bg-transparent px-3.5 text-xl font-extrabold focus:outline-none" value={rule.amt} onChange={(e) => setR('amt', e.target.value)} />
                {rule.type === '%' && <span className="px-3.5 text-lg font-extrabold text-mute">%</span>}
              </div>
              <div className="seggrp"><button className={cn('seg', rule.type === '%' && 'on')} onClick={() => setR('type', '%')}>%</button><button className={cn('seg', rule.type === '$' && 'on')} onClick={() => setR('type', '$')}>$</button></div>
            </div>
            <div className="flex flex-wrap items-center gap-3"><label className="text-sm font-bold" htmlFor="rnd">Round to</label><select id="rnd" className="sel" value={rule.round} onChange={(e) => setR('round', e.target.value)}><option value="none">Nearest cent</option><option value="0.5">Nearest 50c</option><option value="1">Nearest dollar</option><option value="0.95">.95 ending</option></select>
              <label className="check text-sm"><input type="checkbox" checked={rule.skipUnavail} onChange={(e) => setR('skipUnavail', e.target.checked)} /> Skip unavailable products</label></div>
          </Step>
          <Step n="4" title="When?">
            <div className="seggrp self-start"><button className={cn('seg', when === 'now' && 'on')} onClick={() => setWhen('now')}>Apply now</button><button className={cn('seg', when === 'schedule' && 'on')} onClick={() => setWhen('schedule')}>Schedule</button></div>
            {when === 'schedule' && <div className="grid gap-2 sm:grid-cols-2"><Field label="Name" htmlFor="st"><input id="st" className="in in-sm" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Christmas pricing" /></Field><Field label="Run at" htmlFor="sr"><input id="sr" type="datetime-local" className="in in-sm" value={runAt} onChange={(e) => setRunAt(e.target.value)} /></Field></div>}
          </Step>
          {err && <p className="errbox mt-2">{err}</p>}
          <button className="btn btn-p mt-3" onClick={doPreview} disabled={busy === 'preview'}>{busy === 'preview' && <Spinner />} Preview changes</button>
        </section>

        <section className="card card-b">
          <h3 className="font-sans text-base font-extrabold">Preview</h3>
          {!preview ? <p className="py-12 text-center text-sm muted">Build a rule and press <b>Preview changes</b>. Nothing changes until you approve it.</p> : (
            <div className="mt-3 flex flex-col gap-3">
              <p className="text-sm"><b>{preview.description}</b></p>
              <div className="grid grid-cols-3 gap-2.5">{[[included.length, 'prices to change'], [new Set(included.map((r) => r.product)).size, 'products'], [preview.rows.filter((r) => r.error).length, 'errors']].map(([v, l]) => <div key={l} className="rounded-xl bg-cream p-3"><b className="block text-[22px] font-extrabold">{v}</b><span className="text-xs font-semibold muted">{l}</span></div>)}</div>
              <ChangesTable rows={preview.rows} excl={excl} setExcl={setExcl} />
              {when === 'schedule' && <p className="infobox">Scheduled changes recompute prices at run time, so they use whatever prices are current then.</p>}
              <label className="check text-sm"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> I’ve reviewed these prices. Confirmed orders keep the prices customers paid.</label>
              <div className="flex gap-2"><button className="btn btn-o" onClick={() => setPreview(null)}>Discard</button><button className="btn btn-p" disabled={!ack || !included.length || busy === 'apply' || (when === 'schedule' && !runAt)} onClick={apply}>{busy === 'apply' && <Spinner />} {when === 'schedule' ? 'Schedule change' : `Apply ${included.length} changes`}</button></div>
            </div>
          )}
        </section>
      </div>

      <section className="card card-b">
        <h3 className="flex items-center gap-2 font-sans text-base font-extrabold"><FileUp size={18} /> CSV price import</h3>
        <p className="mt-1 text-sm muted">Columns: <code className="text-xs">product_id,product_name,variant,price</code> — product_id is the product’s URL slug.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <label className="btn btn-o btn-sm cursor-pointer">Choose file<input type="file" accept=".csv,text/csv" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setCsv({ text: await f.text(), rows: null }); e.target.value = ''; }} /></label>
          <button className="btn btn-ghost btn-sm" onClick={() => setCsv({ text: SAMPLE, rows: null })}>Load example</button>
        </div>
        <textarea className="in mt-3 font-mono !text-xs" aria-label="CSV contents" value={csv.text} onChange={(e) => setCsv({ text: e.target.value, rows: null })} placeholder={SAMPLE} />
        <button className="btn btn-o btn-sm mt-2" disabled={!csv.text.trim() || busy === 'csv'} onClick={csvPreview}>{busy === 'csv' && <Spinner dark />} Validate</button>
        {csv.rows && (
          <div className="mt-4 flex flex-col gap-3">
            <div className="tblwrap"><table className="tbl"><thead><tr><th>Line</th><th>Product</th><th>Option</th><th>Old</th><th>New</th><th>Result</th></tr></thead>
              <tbody>{csv.rows.map((r) => <tr key={r.line} className={r.status === 'error' ? 'bg-[#FFF4F2]' : ''}><td className="text-xs muted">{r.line}</td><td>{r.name || r.slug}</td><td>{sizeLabel(r.variant)}</td><td className="num">{r.oldPrice != null ? money(r.oldPrice) : '—'}</td><td className="num font-bold">{Number.isFinite(r.newPrice) ? money(r.newPrice) : '—'}</td><td>{r.status === 'error' ? <span className="text-xs font-bold text-bad">{r.error}</span> : <Badge cls={r.status === 'ok' ? 'b-ok' : 'b-mute'}>{r.status === 'ok' ? 'Will update' : 'Unchanged'}</Badge>}</td></tr>)}</tbody></table></div>
            <button className="btn btn-p self-start" disabled={!csv.rows.some((r) => r.status === 'ok') || busy === 'csvapply'} onClick={csvApply}>{busy === 'csvapply' && <Spinner />} Apply {csv.rows.filter((r) => r.status === 'ok').length} valid rows</button>
          </div>
        )}
      </section>

      <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr))]">
        <section className="card card-b">
          <h3 className="font-sans text-base font-extrabold">Scheduled changes</h3>
          {!sched.data?.items.length ? <p className="py-6 text-center text-sm muted">None scheduled.</p> : sched.data.items.map((s) => (
            <div key={s._id} className="flex flex-wrap items-center gap-3 border-b border-line-2 py-3.5 last:border-0">
              <div className="flex-1"><b className="text-sm">{s.title}</b><p className="text-xs muted">{s.description} · {fmtStamp(s.runAt)} · {s.by}{s.error ? ` · ${s.error}` : ''}</p></div><Badge>{s.status}</Badge>
              {s.status === 'Scheduled' && <button className="btn btn-ghost btn-xs" onClick={async () => { try { await api.post(`/admin/pricing/schedules/${s._id}/cancel`); sched.reload({ silent: true }); toast.success('Cancelled'); } catch (e) { toast.error(apiError(e).message); } }}>Cancel</button>}
            </div>
          ))}
        </section>
        <section className="card card-b">
          <h3 className="font-sans text-base font-extrabold">Audit history</h3>
          {!audit.data?.items.length ? <p className="py-6 text-center text-sm muted">No price changes yet.</p> : audit.data.items.map((a) => (
            <div key={a._id} className="flex flex-wrap items-center gap-3 border-b border-line-2 py-3.5 last:border-0">
              <button className="flex flex-1 items-center gap-2 text-left" onClick={() => setOpenAudit(openAudit === a._id ? '' : a._id)} aria-expanded={openAudit === a._id}>
                <ChevronDown size={16} className={cn('transition-transform', openAudit === a._id && 'rotate-180')} />
                <span><b className="text-sm">{a.ref} · {a.description}</b><span className="block text-xs muted">{fmtStamp(a.createdAt)} · {a.by} · {a.source} · {a.changes.length} prices</span></span>
              </button>
              <Badge>{a.status}</Badge>
              {a.status === 'Applied' && <button className="btn btn-ghost btn-xs" onClick={() => setRollback(a)}><RotateCcw size={13} /> Roll back</button>}
              {openAudit === a._id && <div className="w-full"><ChangesTable rows={a.changes.map((c) => ({ ...c, product: String(c.product) }))} /></div>}
            </div>
          ))}
        </section>
      </div>
      <Confirm open={!!rollback} title={`Roll back ${rollback?.ref}?`} confirmLabel="Roll back" busy={busy === 'rb'} onClose={() => setRollback(null)} onConfirm={async () => {
        setBusy('rb');
        try { await api.post(`/admin/pricing/audit/${rollback._id}/rollback`); toast.success('Prices restored'); setRollback(null); audit.reload({ silent: true }); } catch (e) { toast.error(apiError(e).message); } finally { setBusy(''); }
      }}>{rollback?.changes.length} prices will return to their previous values.</Confirm>
    </>
  );
}
