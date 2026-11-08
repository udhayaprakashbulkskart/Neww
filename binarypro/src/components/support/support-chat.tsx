'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';

interface Msg { role: 'user' | 'assistant'; content: string; links?: { href: string; label: string }[]; handoff?: boolean }

const QUICK = ['How do I join?', 'How does cashback work?', 'When can I withdraw?', 'Talk to a person'];
const GREETING: Msg = { role: 'assistant', content: 'Hi, I am the CrownTree support assistant. Ask me about plans, cashback, withdrawals, returns or the app.' };

/** Floating support chat. Answers come from /api/support/chat and never include a password or OTP request. */
export function SupportChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, busy]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    const history = messages.filter((m) => m !== GREETING).map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: 'user', content: message }]);
    setInput('');
    setBusy(true);
    try {
      const res = await fetch('/api/support/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, history }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setMessages((m) => [...m, { role: 'assistant', content: json?.error?.message ?? 'Something went wrong. Please try again.' }]);
      else setMessages((m) => [...m, { role: 'assistant', content: json.reply, links: json.links, handoff: json.handoff }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Network problem. Check your connection and try again.' }]);
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) { e.preventDefault(); send(input); }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? 'Close support chat' : 'Open support chat'}
        className="fixed bottom-24 right-4 z-50 grid h-14 w-14 place-items-center rounded-full bg-[linear-gradient(135deg,#ff6a00,#d4af37)] text-black shadow-[0_12px_40px_rgba(255,106,0,.45)] transition hover:scale-105 lg:bottom-6 lg:right-6"
      >
        {open ? (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M4 5h16v11H9l-5 4V5z" /></svg>
        )}
        <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-black" aria-hidden="true" />
      </button>

      {open && (
        <section role="dialog" aria-label="CrownTree support" className="fixed bottom-44 right-4 z-50 flex h-[min(540px,70vh)] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#070707] shadow-[0_30px_90px_rgba(0,0,0,.8)] lg:bottom-24 lg:right-6">
          <header className="flex items-center justify-between border-b border-white/10 bg-[linear-gradient(120deg,#1f1706,#070707)] px-5 py-4">
            <div>
              <div className="text-sm font-bold">CrownTree support</div>
              <div className="text-[11px] text-emerald-300">Online · AI assistant</div>
            </div>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[linear-gradient(135deg,#ff6a00,#d4af37)] text-xs font-black text-black">CT</span>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${m.role === 'user' ? 'bg-[linear-gradient(135deg,#ff6a00,#d4af37)] text-black' : 'border border-white/10 bg-white/[0.04] text-[#e8e2d2]'}`}>
                  <p className="whitespace-pre-line">{m.content}</p>
                  {m.links && m.links.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {m.links.map((l) => <a key={l.href} href={l.href} className="rounded-full border border-[#d4af37]/40 px-3 py-1 text-xs text-[#f7e09a] hover:bg-white/5">{l.label}</a>)}
                    </div>
                  )}
                  {m.handoff && <p className="mt-2 text-[11px] text-[#f7e09a]">A support team member will review this conversation. Please keep your reference handy.</p>}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start"><div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"><span className="flex gap-1" aria-label="Assistant is typing"><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#d4af37]" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#d4af37] [animation-delay:150ms]" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#d4af37] [animation-delay:300ms]" /></span></div></div>
            )}
          </div>

          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-2 px-4 pb-2">
              {QUICK.map((q) => <button key={q} type="button" onClick={() => send(q)} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-[#cfc6b0] hover:border-[#d4af37]/50">{q}</button>)}
            </div>
          )}

          <form onSubmit={submit} className="flex gap-2 border-t border-white/10 p-3">
            <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={1000} placeholder="Type your question" aria-label="Message" className="input py-2.5 text-sm" />
            <button className="btn btn-brand px-4 py-2 text-sm" disabled={busy || !input.trim()}>Send</button>
          </form>
          <p className="px-4 pb-3 text-[10px] text-[#6f6758]">Never share your password or OTP here.</p>
        </section>
      )}
    </>
  );
}
