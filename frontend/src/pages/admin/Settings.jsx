import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import { api, apiError } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { Badge, ErrorState, Field, Modal, PageLoader, Spinner, Switch } from '../../components/ui.jsx';
import { cn, fmtStamp } from '../../utils/format.js';

const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TABS = [['business', 'Business'], ['hours', 'Hours & pickup'], ['payments', 'Payments'], ['cake', 'Cake options'], ['notify', 'Notifications'], ['chat', 'Chat widget'], ['staff', 'Staff & access'], ['messages', 'Website messages']];
const PERMS = ['orders', 'production', 'calendar', 'products', 'pricing', 'enquiries', 'customers', 'reports', 'ai', 'settings'];

function OptionList({ title, list, onChange, disabled }) {
  return (
    <div className="card card-b">
      <h3 className="mb-3 text-sm font-extrabold">{title}</h3>
      {list.map((o, i) => (
        <div key={i} className="mb-2 flex items-center gap-2">
          <input className="in in-sm flex-1" aria-label={`${title} name`} value={o.name} disabled={disabled} onChange={(e) => onChange(list.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
          <span className="text-sm muted">+$</span>
          <input className="in in-sm !w-20" type="number" min="0" step="0.5" aria-label={`${o.name} price`} value={o.price} disabled={disabled} onChange={(e) => onChange(list.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
          <Switch on={o.active !== false} label={`${o.name} active`} disabled={disabled} onChange={(v) => onChange(list.map((x, j) => (j === i ? { ...x, active: v } : x)))} />
          <button className="iconbtn !h-8 !w-8" aria-label={`Remove ${o.name}`} disabled={disabled} onClick={() => onChange(list.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
        </div>
      ))}
      {!disabled && <button className="btn btn-ghost btn-xs" onClick={() => onChange([...list, { name: '', price: 0, active: true }])}><Plus size={13} /> Add</button>}
    </div>
  );
}

function Staff() {
  const [list, setList] = useState(null);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => api.get('/admin/staff').then(({ data }) => setList(data.items)).catch((e) => toast.error(apiError(e).message));
  useEffect(() => { load(); }, []);
  const save = async () => {
    setBusy(true);
    try {
      const body = { name: edit.name, email: edit.email, phone: edit.phone || '', staffRole: edit.staffRole, permissions: edit.permissions, active: edit.active };
      if (edit.password) body.password = edit.password;
      if (edit.id) await api.patch(`/admin/staff/${edit.id}`, body); else await api.post('/admin/staff', body);
      toast.success('Staff saved'); setEdit(null); load();
    } catch (e) { const ae = apiError(e); toast.error(Object.values(ae.fields)[0] || ae.message); } finally { setBusy(false); }
  };
  if (!list) return <PageLoader />;
  return (
    <div className="card card-b">
      <div className="mb-3 flex items-center"><h3 className="flex-1 text-sm font-extrabold">Staff accounts</h3><button className="btn btn-p btn-sm" onClick={() => setEdit({ name: '', email: '', staffRole: 'baker', permissions: ['orders', 'production', 'calendar', 'enquiries'], active: true, password: '' })}><Plus size={14} /> Add staff</button></div>
      <div className="tblwrap"><table className="tbl"><thead><tr><th>Name</th><th>Role</th><th>Access</th><th>Status</th><th /></tr></thead>
        <tbody>{list.map((s) => <tr key={s.id}><td><b>{s.name}</b><div className="text-xs muted">{s.email}</div></td><td className="capitalize">{s.staffRole}</td><td className="text-xs">{s.staffRole === 'owner' ? 'Everything' : s.permissions.join(', ')}</td><td>{s.active ? <Badge cls="b-ok">Active</Badge> : <Badge cls="b-mute">Disabled</Badge>}<div className="text-[11px] muted">{s.lastLoginAt ? `Last in ${fmtStamp(s.lastLoginAt)}` : 'Never signed in'}</div></td><td><button className="btn btn-ghost btn-xs" onClick={() => setEdit({ ...s, password: '' })}>Edit</button></td></tr>)}</tbody></table></div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? `Edit ${edit.name}` : 'Add staff member'} footer={<><button className="btn btn-o" onClick={() => setEdit(null)}>Cancel</button><button className="btn btn-p" onClick={save} disabled={busy}>{busy && <Spinner />} Save</button></>}>
        {edit && <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Name" htmlFor="sn"><input id="sn" className="in" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field><Field label="Email" htmlFor="se"><input id="se" type="email" className="in" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Role" htmlFor="sr"><select id="sr" className="in" value={edit.staffRole} onChange={(e) => setEdit({ ...edit, staffRole: e.target.value })}><option value="owner">Owner</option><option value="manager">Manager</option><option value="baker">Baker</option><option value="counter">Counter staff</option></select></Field>
            <Field label={edit.id ? 'New password (optional)' : 'Temporary password'} htmlFor="sp" help="At least 8 characters"><input id="sp" type="password" autoComplete="new-password" className="in" value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} /></Field>
          </div>
          {edit.staffRole !== 'owner' && <div><span className="lbl">Module access</span><div className="flex flex-wrap gap-x-4">{PERMS.map((p) => <label key={p} className="check capitalize"><input type="checkbox" checked={edit.permissions?.includes(p)} onChange={(e) => setEdit({ ...edit, permissions: e.target.checked ? [...(edit.permissions || []), p] : edit.permissions.filter((x) => x !== p) })} />{p === 'ai' ? 'AI assistant' : p}</label>)}</div></div>}
          <label className="check"><input type="checkbox" checked={edit.active !== false} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Account active</label>
        </div>}
      </Modal>
    </div>
  );
}

function Messages() {
  const [items, setItems] = useState(null);
  const load = () => api.get('/admin/messages').then(({ data }) => setItems(data.items)).catch(() => setItems([]));
  useEffect(() => { load(); }, []);
  if (!items) return <PageLoader />;
  if (!items.length) return <div className="empty">No messages from the website yet.</div>;
  return <div className="card card-b">{items.map((m) => <div key={m._id} className={cn('border-b border-line-2 py-3.5 last:border-0', m.handled && 'opacity-60')}><div className="flex flex-wrap items-center gap-2"><b>{m.name}</b><a href={`mailto:${m.email}`} className="text-sm">{m.email}</a>{m.phone && <span className="text-sm muted">{m.phone}</span>}<span className="flex-1 text-right text-xs muted">{fmtStamp(m.createdAt)}</span>{!m.handled && <button className="btn btn-o btn-xs" onClick={async () => { await api.post(`/admin/messages/${m._id}/handled`); load(); }}>Mark handled</button>}</div><p className="mt-1 whitespace-pre-wrap text-sm">{m.message}</p></div>)}</div>;
}

export default function Settings() {
  const { can } = useAuth();
  const { reload: reloadPublic } = useSettings();
  const [tab, setTab] = useState('business');
  const [s, setS] = useState(null);
  const [cats, setCats] = useState([]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const ro = !can('settings');

  useEffect(() => { api.get('/admin/settings').then(({ data }) => { setS(data.settings); setCats(data.categories); }).catch((e) => setError(apiError(e).message)); }, []);
  if (error) return <ErrorState message={error} />;
  if (!s) return <PageLoader />;

  const upd = (k, v) => { setS((x) => ({ ...x, [k]: v })); setDirty(true); };
  const nest = (k, kk, v) => upd(k, { ...s[k], [kk]: v });
  const save = async () => {
    setSaving(true);
    try {
      const num = (o) => o.map((x) => ({ ...x, price: Number(x.price) || 0 }));
      const body = {
        business: s.business, currency: s.currency, locale: s.locale, timezone: s.timezone, hours: s.hours, slotMinutes: Number(s.slotMinutes), slotCapacity: Number(s.slotCapacity),
        lastSlotBeforeCloseMinutes: Number(s.lastSlotBeforeCloseMinutes), maxAdvanceDays: Number(s.maxAdvanceDays), prepHours: Object.fromEntries(Object.entries(s.prepHours).map(([k, v]) => [k, Number(v)])),
        payments: { ...s.payments, depositPercent: Number(s.payments.depositPercent) }, fees: { ...s.fees, serviceFee: Number(s.fees.serviceFee) },
        cakeOptions: { sponges: num(s.cakeOptions.sponges.filter((o) => o.name.trim())), fillings: num(s.cakeOptions.fillings.filter((o) => o.name.trim())), finishes: num(s.cakeOptions.finishes.filter((o) => o.name.trim())), addons: num(s.cakeOptions.addons.filter((o) => o.name.trim())), maxMessageLength: Number(s.cakeOptions.maxMessageLength) },
        notifications: s.notifications, chatWidget: { ...s.chatWidget, prompts: s.chatWidget.prompts.filter((p) => p.trim()), qa: s.chatWidget.qa.filter((q) => q.q.trim() && q.a.trim()) },
        bakers: s.bakers.filter((b) => b.trim()),
      };
      const { data } = await api.patch('/admin/settings', body);
      setS(data.settings); setDirty(false); reloadPublic(); toast.success('Settings saved');
    } catch (e) { const ae = apiError(e); toast.error(ae.fields ? `${ae.message} (${Object.keys(ae.fields).join(', ')})` : ae.message); } finally { setSaving(false); }
  };

  const visibleTabs = TABS.filter(([k]) => (k === 'staff' ? can('settings') : k === 'messages' ? can('customers') : true));
  const saveBar = !['staff', 'messages'].includes(tab) && !ro;

  return (
    <>
      <div className="flex flex-wrap gap-1.5">{visibleTabs.map(([k, l]) => <button key={k} className={cn('tab', tab === k && 'on')} onClick={() => setTab(k)}>{l}</button>)}</div>
      {ro && !['messages'].includes(tab) && <p className="infobox">You can view settings but only the owner (or staff with settings access) can change them.</p>}
      <fieldset disabled={ro} className="contents">
        {tab === 'business' && (
          <div className="card card-b grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr))]">
            {[['name', 'Business name'], ['tagline', 'Tagline'], ['address', 'Pickup address'], ['phone', 'Phone'], ['email', 'Email'], ['abn', 'ABN']].map(([k, l]) => <Field key={k} label={l} htmlFor={`b-${k}`}><input id={`b-${k}`} className="in" value={s.business[k] || ''} onChange={(e) => nest('business', k, e.target.value)} /></Field>)}
            <Field label="Announcement bar" htmlFor="b-ann" className="col-span-full" help="Shown at the top of every storefront page. Leave blank to hide."><input id="b-ann" className="in" value={s.business.announcement || ''} onChange={(e) => nest('business', 'announcement', e.target.value)} /></Field>
            <Field label="Currency" htmlFor="b-cur"><input id="b-cur" className="in" maxLength={3} value={s.currency} onChange={(e) => upd('currency', e.target.value.toUpperCase())} /></Field>
            <Field label="Time zone" htmlFor="b-tz" help="IANA name, e.g. Australia/Melbourne"><input id="b-tz" className="in" value={s.timezone} onChange={(e) => upd('timezone', e.target.value)} /></Field>
            <Field label="Bakers (for production assignment)" htmlFor="b-bk" className="col-span-full" help="Comma separated"><input id="b-bk" className="in" value={s.bakers.join(', ')} onChange={(e) => upd('bakers', e.target.value.split(',').map((x) => x.trimStart()))} /></Field>
          </div>
        )}
        {tab === 'hours' && (
          <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr))]">
            <div className="card card-b">
              <h3 className="mb-3 text-sm font-extrabold">Opening hours</h3>
              {s.hours.map((h, i) => (
                <div key={i} className="flex flex-wrap items-center gap-3 border-b border-line-2 py-2.5 last:border-0">
                  <b className="w-24 text-sm">{WD[i]}</b>
                  <Switch on={!h.closed} label={`${WD[i]} open`} disabled={ro} onChange={(v) => upd('hours', s.hours.map((x, j) => (j === i ? { ...x, closed: !v } : x)))} />
                  {h.closed ? <span className="text-sm muted">Closed</span> : <>
                    <input type="time" className="in in-sm !w-auto" aria-label={`${WD[i]} open`} value={h.open} onChange={(e) => upd('hours', s.hours.map((x, j) => (j === i ? { ...x, open: e.target.value } : x)))} /><span className="muted">to</span>
                    <input type="time" className="in in-sm !w-auto" aria-label={`${WD[i]} close`} value={h.close} onChange={(e) => upd('hours', s.hours.map((x, j) => (j === i ? { ...x, close: e.target.value } : x)))} />
                  </>}
                </div>
              ))}
            </div>
            <div className="card card-b flex flex-col gap-4">
              <h3 className="text-sm font-extrabold">Pickup slots</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Slot length (minutes)" htmlFor="h-sm"><input id="h-sm" type="number" min="15" step="15" className="in" value={s.slotMinutes} onChange={(e) => upd('slotMinutes', e.target.value)} /></Field>
                <Field label="Orders per slot" htmlFor="h-sc"><input id="h-sc" type="number" min="1" className="in" value={s.slotCapacity} onChange={(e) => upd('slotCapacity', e.target.value)} /></Field>
                <Field label="Last slot before close (minutes)" htmlFor="h-ls"><input id="h-ls" type="number" min="0" className="in" value={s.lastSlotBeforeCloseMinutes} onChange={(e) => upd('lastSlotBeforeCloseMinutes', e.target.value)} /></Field>
                <Field label="Book up to (days ahead)" htmlFor="h-ma"><input id="h-ma" type="number" min="1" className="in" value={s.maxAdvanceDays} onChange={(e) => upd('maxAdvanceDays', e.target.value)} /></Field>
              </div>
              <h3 className="mt-2 text-sm font-extrabold">Notice needed (hours) by category</h3>
              <div className="grid gap-3 sm:grid-cols-2">{cats.map((c) => <Field key={c.id} label={c.name} htmlFor={`ph-${c.id}`}><input id={`ph-${c.id}`} type="number" min="0" className="in" value={s.prepHours[c.id] ?? ''} onChange={(e) => nest('prepHours', c.id, e.target.value)} /></Field>)}</div>
              <p className="help">Individual products can override this in Products & Inventory. Block holidays from the Pickup Calendar.</p>
            </div>
          </div>
        )}
        {tab === 'payments' && (
          <div className="card card-b flex max-w-2xl flex-col gap-4">
            <label className="flex items-center gap-3 text-sm font-bold"><Switch on={s.payments.payAtPickup} disabled={ro} label="Pay at pickup" onChange={(v) => nest('payments', 'payAtPickup', v)} /> Allow pay at pickup</label>
            <label className="flex items-center gap-3 text-sm font-bold"><Switch on={s.payments.onlineEnabled} disabled={ro} label="Online payments" onChange={(v) => nest('payments', 'onlineEnabled', v)} /> Offer online card payments (Stripe)</label>
            <p className="help -mt-2">Online payments also require STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET on the server. Orders are only marked paid after Stripe confirms the payment.</p>
            <Field label="Deposit percentage" htmlFor="p-dp"><input id="p-dp" type="number" min="0" max="100" className="in !w-32" value={s.payments.depositPercent} onChange={(e) => nest('payments', 'depositPercent', e.target.value)} /></Field>
            <div><span className="lbl">Deposit required for</span><div className="flex flex-wrap gap-x-4">{cats.map((c) => <label key={c.id} className="check"><input type="checkbox" checked={s.payments.depositRequiredFor.includes(c.id)} onChange={(e) => nest('payments', 'depositRequiredFor', e.target.checked ? [...s.payments.depositRequiredFor, c.id] : s.payments.depositRequiredFor.filter((x) => x !== c.id))} />{c.name}</label>)}</div></div>
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Service fee per order ($)" htmlFor="p-sf"><input id="p-sf" type="number" min="0" step="0.01" className="in" value={s.fees.serviceFee} onChange={(e) => nest('fees', 'serviceFee', e.target.value)} /></Field><Field label="Fee label" htmlFor="p-sl"><input id="p-sl" className="in" value={s.fees.serviceFeeLabel} onChange={(e) => nest('fees', 'serviceFeeLabel', e.target.value)} /></Field></div>
          </div>
        )}
        {tab === 'cake' && (
          <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr))]">
            {[['sponges', 'Sponges'], ['fillings', 'Fillings'], ['finishes', 'Finishes & decoration'], ['addons', 'Add-ons']].map(([k, l]) => <OptionList key={k} title={l} list={s.cakeOptions[k]} disabled={ro} onChange={(v) => nest('cakeOptions', k, v)} />)}
            <div className="card card-b"><Field label="Max cake message length" htmlFor="c-mm"><input id="c-mm" type="number" min="5" className="in !w-32" value={s.cakeOptions.maxMessageLength} onChange={(e) => nest('cakeOptions', 'maxMessageLength', e.target.value)} /></Field><p className="help">Price changes here apply to new carts and orders. Existing orders keep their prices.</p></div>
          </div>
        )}
        {tab === 'notify' && (
          <div className="card card-b flex max-w-2xl flex-col gap-3">
            {[['customerConfirmation', 'Email customers an order confirmation'], ['newOrder', 'Email staff about new orders'], ['enquiry', 'Email staff about custom cake enquiries'], ['lowStock', 'Low-stock alerts on dashboard']].map(([k, l]) => <label key={k} className="flex items-center gap-3 text-sm font-bold"><Switch on={!!s.notifications[k]} disabled={ro} label={l} onChange={(v) => nest('notifications', k, v)} />{l}</label>)}
            <Field label="Staff notification email" htmlFor="n-se"><input id="n-se" type="email" className="in" value={s.notifications.staffEmail || ''} onChange={(e) => nest('notifications', 'staffEmail', e.target.value)} /></Field>
            <p className="help">Emails are sent through the SMTP server configured in the backend .env. Without SMTP, emails are logged instead of sent.</p>
          </div>
        )}
        {tab === 'chat' && (
          <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr))]">
            <div className="card card-b flex flex-col gap-3">
              <label className="flex items-center gap-3 text-sm font-bold"><Switch on={s.chatWidget.enabled !== false} disabled={ro} label="Chat enabled" onChange={(v) => nest('chatWidget', 'enabled', v)} /> Show chat button on the website</label>
              <div className="grid gap-3 sm:grid-cols-[1fr_120px]"><Field label="Assistant name" htmlFor="w-n"><input id="w-n" className="in" value={s.chatWidget.name} onChange={(e) => nest('chatWidget', 'name', e.target.value)} /></Field><Field label="Colour" htmlFor="w-c"><input id="w-c" type="color" className="in !p-1" value={s.chatWidget.color} onChange={(e) => nest('chatWidget', 'color', e.target.value)} /></Field></div>
              <Field label="Welcome message" htmlFor="w-w"><textarea id="w-w" className="in !min-h-[70px]" value={s.chatWidget.welcome} onChange={(e) => nest('chatWidget', 'welcome', e.target.value)} /></Field>
              <Field label="Suggested questions (one per line)" htmlFor="w-p"><textarea id="w-p" className="in" value={s.chatWidget.prompts.join('\n')} onChange={(e) => nest('chatWidget', 'prompts', e.target.value.split('\n'))} /></Field>
            </div>
            <div className="card card-b flex flex-col gap-3">
              <h3 className="text-sm font-extrabold">Custom answers</h3>
              <p className="help !mt-0">Checked before the built-in answers (hours, notice, sizes, dietary).</p>
              {s.chatWidget.qa.map((q, i) => (
                <div key={i} className="flex flex-col gap-1.5 rounded-xl bg-cream p-3">
                  <div className="flex gap-2"><input className="in in-sm flex-1" aria-label="Question" placeholder="Question" value={q.q} onChange={(e) => nest('chatWidget', 'qa', s.chatWidget.qa.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} /><button className="iconbtn !h-9 !w-9" aria-label="Remove" onClick={() => nest('chatWidget', 'qa', s.chatWidget.qa.filter((_, j) => j !== i))}><Trash2 size={14} /></button></div>
                  <textarea className="in !min-h-[60px] !text-sm" aria-label="Answer" placeholder="Answer" value={q.a} onChange={(e) => nest('chatWidget', 'qa', s.chatWidget.qa.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} />
                </div>
              ))}
              {!ro && <button className="btn btn-ghost btn-xs self-start" onClick={() => nest('chatWidget', 'qa', [...s.chatWidget.qa, { q: '', a: '' }])}><Plus size={13} /> Add answer</button>}
            </div>
          </div>
        )}
      </fieldset>
      {tab === 'staff' && can('settings') && <Staff />}
      {tab === 'messages' && can('customers') && <Messages />}
      {saveBar && (
        <div className="sticky bottom-0 z-10 -mx-4 flex items-center gap-3 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur lg:-mx-8 lg:px-8">
          <span className="flex-1 text-sm muted">{dirty ? 'You have unsaved changes.' : 'All changes saved.'}</span>
          <button className="btn btn-p" disabled={!dirty || saving} onClick={save}>{saving && <Spinner />} Save settings</button>
        </div>
      )}
    </>
  );
}
