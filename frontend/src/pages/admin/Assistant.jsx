import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Bot, Send, Trash2 } from 'lucide-react';
import { api, apiError } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Spinner } from '../../components/ui.jsx';
import { cn, money, sizeLabel, uid } from '../../utils/format.js';

function Reply({ m, onDecide }) {
  return (
    <div className="flex max-w-full flex-col gap-3">
      <p>{m.text}</p>
      {m.type === 'table' && m.rows?.length > 0 && (
        <div className="tblwrap"><table className="tbl"><thead><tr>{m.cols.map((c) => <th key={c}>{c}</th>)}</tr></thead><tbody>{m.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div>
      )}
      {m.type === 'list' && <ul className="flex flex-col gap-1.5">{m.items.map((it) => <li key={it.label}><Link to={it.to} className="att"><span className="flex-1 text-sm"><b>{it.label}</b><span className="block text-xs muted">{it.sub}</span></span></Link></li>)}</ul>}
      {m.type === 'bars' && <div className="flex flex-col gap-3">{m.bars.map((b) => <div key={b.label} className="flex flex-col gap-1"><div className="flex gap-2 text-[13px]"><b className="flex-1">{b.label}</b><span className="muted">{b.sub}</span><b>{b.value}</b></div><div className="h-2 overflow-hidden rounded-full bg-[#F1E8DB]"><div className="h-full rounded-full bg-wine" style={{ width: `${b.pct}%` }} /></div></div>)}</div>}
      {m.type === 'price' && (
        <div className="flex flex-col gap-2.5">
          <div className="max-h-[300px] overflow-auto rounded-xl border border-line-2"><table className="tbl"><thead><tr><th>Product</th><th>Option</th><th>Old</th><th>New</th></tr></thead><tbody>{m.rows.map((r, i) => <tr key={i} className={r.error ? 'bg-[#FFF4F2]' : ''}><td>{r.name}{r.error && <span className="block text-xs text-bad">{r.error}</span>}</td><td>{sizeLabel(r.variant)}</td><td className="num text-mute line-through">{money(r.oldPrice)}</td><td className="num font-extrabold text-wine">{money(r.newPrice)}</td></tr>)}</tbody></table></div>
          {m.status === 'pending' && <div className="flex gap-2"><button className="btn btn-o btn-sm" onClick={() => onDecide(m, false)}>Cancel</button><button className="btn btn-p btn-sm" disabled={m.busy} onClick={() => onDecide(m, true)}>{m.busy && <Spinner />} Approve & apply</button></div>}
          {m.status === 'applied' && <span className="badge b-ok self-start">Applied · {m.auditRef}</span>}
          {m.status === 'cancelled' && <span className="badge b-mute self-start">Cancelled — no prices changed</span>}
        </div>
      )}
      {(m.actions?.length > 0 || m.suggestions?.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {m.actions?.map((a) => <Link key={a.to} to={a.to} className="chip">{a.label}</Link>)}
          {m.suggestions?.map((s) => <button key={s} className="chip" onClick={() => onDecide(null, null, s)}>{s}</button>)}
        </div>
      )}
    </div>
  );
}

export default function Assistant() {
  const { can } = useAuth();
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const end = useRef(null);
  useEffect(() => { api.get('/admin/ai/suggestions').then(({ data }) => setSuggestions(data.suggestions)).catch(() => {}); }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs, busy]);

  const ask = async (text) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setMsgs((m) => [...m, { id: uid(), from: 'me', text: q }]);
    setInput(''); setBusy(true);
    try { const { data } = await api.post('/admin/ai/ask', { message: q }); setMsgs((m) => [...m, { id: uid(), from: 'ai', ...data.reply }]); } catch (e) { setMsgs((m) => [...m, { id: uid(), from: 'ai', type: 'text', text: apiError(e).message }]); } finally { setBusy(false); }
  };

  const decide = async (m, ok, suggestion) => {
    if (suggestion) { ask(suggestion); return; }
    const patch = (p) => setMsgs((list) => list.map((x) => (x.id === m.id ? { ...x, ...p } : x)));
    if (!ok) { patch({ status: 'cancelled' }); return; }
    if (!can('pricing')) { toast.error('Your account does not have pricing access.'); return; }
    patch({ busy: true });
    try {
      const { data } = await api.post('/admin/pricing/apply', { changes: m.rows.filter((r) => !r.error), description: m.description, source: 'AI Assistant' });
      patch({ status: 'applied', auditRef: data.audit.ref, busy: false });
      setMsgs((list) => [...list, { id: uid(), from: 'ai', type: 'text', text: `Done. ${data.audit.changes.length} prices were updated and recorded in the pricing audit as ${data.audit.ref}. Confirmed orders keep the prices customers paid.`, actions: [{ label: 'View audit history', to: '/admin/pricing' }, { label: 'See prices on the website', to: '/shop?category=cakes' }] }]);
    } catch (e) { patch({ busy: false }); toast.error(apiError(e).message); }
  };

  return (
    <div className="card flex min-h-[calc(100vh-170px)] flex-col">
      <div className="card-h"><Bot className="text-wine" /><h3 className="flex-1">Staff assistant</h3>{msgs.length > 0 && <button className="btn btn-ghost btn-xs" onClick={() => setMsgs([])}><Trash2 size={13} /> Clear</button>}</div>
      <p className="px-[22px] pt-1 text-xs muted">Answers come from your live orders, products and enquiries. Price changes are always previewed and need your approval.</p>
      <div className="flex flex-1 flex-col gap-4 overflow-auto px-[22px] py-5" aria-live="polite">
        <div className="flex gap-3"><span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-wine-d"><img src="/images/sparkle.svg" alt="" className="h-5 w-5" /></span><div className="rounded-2xl rounded-tl-md border border-line-2 bg-white px-4 py-3 text-sm"><b>Hi, I’m the bakery assistant.</b> Ask about orders, pickups, payments, stock, enquiries or bestsellers — or ask me to change prices.</div></div>
        {msgs.map((m) => m.from === 'me'
          ? <div key={m.id} className="max-w-[80%] self-end rounded-2xl rounded-br-md bg-wine px-4 py-2.5 text-sm text-white">{m.text}</div>
          : <div key={m.id} className="flex gap-3"><span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-wine-d"><img src="/images/sparkle.svg" alt="" className="h-5 w-5" /></span><div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-line-2 bg-white px-4 py-3 text-sm"><Reply m={m} onDecide={decide} /></div></div>)}
        {busy && <div className="typing ml-12 rounded-2xl border border-line-2 bg-white" aria-label="Assistant is thinking"><i /><i /><i /></div>}
        <div ref={end} />
      </div>
      {!msgs.length && <div className="flex flex-wrap gap-1.5 px-[22px] pb-3">{suggestions.map((s) => <button key={s} className="chip" onClick={() => ask(s)}>{s}</button>)}</div>}
      <form className="flex gap-2 border-t border-line-2 p-4" onSubmit={(e) => { e.preventDefault(); ask(); }}>
        <label className="sr-only" htmlFor="ai-in">Ask the assistant</label>
        <input id="ai-in" className={cn('in !rounded-full')} value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. Which orders are unpaid?" maxLength={500} />
        <button className="btn btn-p" disabled={busy || !input.trim()} aria-label="Send"><Send size={17} /></button>
      </form>
    </div>
  );
}
