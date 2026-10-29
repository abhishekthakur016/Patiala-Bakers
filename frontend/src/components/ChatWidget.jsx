import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Send, X } from 'lucide-react';
import { api } from '../api/client.js';
import { useSettings } from '../context/SettingsContext.jsx';

export default function ChatWidget() {
  const { settings } = useSettings();
  const w = settings?.chatWidget;
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const body = useRef(null);

  useEffect(() => { body.current?.scrollTo({ top: body.current.scrollHeight, behavior: 'smooth' }); }, [msgs, busy]);
  if (!w || w.enabled === false) return null;
  const color = w.color || '#6E1630';

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setMsgs((m) => [...m, { from: 'me', text: q }]);
    setInput('');
    setBusy(true);
    try {
      const { data } = await api.post('/chat', { message: q });
      setMsgs((m) => [...m, { from: 'bot', ...data }]);
    } catch {
      setMsgs((m) => [...m, { from: 'bot', text: `Sorry, I could not answer that just now. Call us on ${settings.business.phone}.`, links: [] }]);
    } finally { setBusy(false); }
  };

  return (
    <div className="no-print">
      {open && (
        <section className="chatpanel" aria-label="Chat with the bakery">
          <header className="flex items-center gap-3 px-[18px] py-4 text-white" style={{ background: color }}>
            <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white/20 font-serif text-lg font-bold">PB</span>
            <div className="flex-1"><b className="block">{w.name}</b><span className="text-xs opacity-80">Usually instant answers</span></div>
            <button className="iconbtn !text-white hover:!bg-white/10" onClick={() => setOpen(false)} aria-label="Close chat"><X size={20} /></button>
          </header>
          <div ref={body} className="flex flex-1 flex-col gap-2.5 overflow-auto bg-cream p-4" aria-live="polite">
            <div className="bub bot">{w.welcome}</div>
            {!msgs.length && <div className="flex flex-wrap gap-1.5">{w.prompts?.filter(Boolean).map((p) => <button key={p} className="chip" onClick={() => send(p)}>{p}</button>)}</div>}
            {msgs.map((m, i) => (
              <div key={i} className={`bub ${m.from === 'me' ? 'me' : 'bot'}`} style={m.from === 'me' ? { background: color } : undefined}>
                {m.text}
                {m.links?.length > 0 && <div className="mt-2.5 flex flex-wrap gap-1.5">{m.links.map((l) => <Link key={l.to} to={l.to} className="chip" onClick={() => setOpen(false)}>{l.label}</Link>)}</div>}
              </div>
            ))}
            {busy && <div className="bub bot typing" aria-label="Assistant is typing"><i /><i /><i /></div>}
          </div>
          <form className="flex gap-2 border-t border-line-2 bg-white p-3" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <label className="sr-only" htmlFor="chat-in">Message</label>
            <input id="chat-in" className="in !rounded-full" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about cakes, pickup, sizes…" maxLength={500} />
            <button className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-white" style={{ background: color }} aria-label="Send" disabled={busy}><Send size={18} /></button>
          </form>
        </section>
      )}
      <button className="chatfab" style={{ background: color }} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? <X size={22} /> : <MessageCircle size={22} />} {open ? 'Close' : 'Ask us'}
      </button>
    </div>
  );
}
