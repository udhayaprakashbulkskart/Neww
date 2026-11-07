'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';

type ApiResult<T = unknown> = { ok: true; data: T } | { ok: false; message: string };

async function call<T = unknown>(url: string, method: 'POST' | 'PATCH' | 'PUT', body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, message: json?.error?.message ?? `Request failed (${res.status})` };
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, message: 'Network error. Check your connection and try again.' };
  }
}

function Message({ kind, text }: { kind: 'ok' | 'err'; text: string }) {
  return (
    <p role="status" className={`text-sm ${kind === 'ok' ? 'text-emerald-300' : 'text-red-300'}`}>
      {text}
    </p>
  );
}

function useBusy() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  return { busy, setBusy, msg, setMsg };
}

// ---------- Sign in and create account (email and password) ----------
export function LoginForm({ ref, initialMode = 'signin' }: { ref?: string; initialMode?: 'signin' | 'register' }) {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, setBusy, msg, setMsg } = useBusy();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = mode === 'signin'
      ? await call('/api/auth/login', 'POST', { email, password })
      : await call('/api/auth/register', 'POST', { name, email, password, ref: ref ?? null });
    setBusy(false);
    if (r.ok) router.push('/dashboard');
    else setMsg({ kind: 'err', text: r.message });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-black/60 p-1 text-sm ring-1 ring-white/5">
        {(['signin', 'register'] as const).map((m) => (
          <button key={m} type="button" onClick={() => { setMode(m); setMsg(null); }}
            className={`rounded-xl py-2.5 font-semibold transition ${mode === m ? 'bg-[linear-gradient(135deg,#ff6a00,#d4af37)] text-black shadow-[0_6px_20px_rgba(255,106,0,.3)]' : 'text-[#a39a86] hover:text-white'}`}>
            {m === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        ))}
      </div>
      {mode === 'register' && (
        <div>
          <label className="label" htmlFor="name">Full name</label>
          <input id="name" className="input mt-2" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoComplete="name" />
        </div>
      )}
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" type="email" className="input mt-2" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" type="password" className="input mt-2" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={mode === 'register' ? 10 : 1} maxLength={128} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />
        {mode === 'register' && <p className="mt-1 text-xs text-[#8f8672]">At least 10 characters, with a letter and a number.</p>}
      </div>
      <button className="btn btn-brand w-full py-3.5" disabled={busy}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
      {msg && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{msg.text}</div>}
    </form>
  );
}

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="btn btn-ghost px-3 py-2 text-xs"
      onClick={async () => {
        await call('/api/auth/logout', 'POST');
        router.push('/login');
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}

// ---------- Membership checkout ----------
export function MembershipPicker({ currentTier, tiers }: { currentTier: string; tiers: { tier: string; price: string }[] }) {
  const router = useRouter();
  const { busy, setBusy, msg, setMsg } = useBusy();
  const [pending, setPending] = useState<{ providerRef: string; amount: string } | null>(null);

  async function choose(tier: string) {
    setBusy(true); setMsg(null);
    const r = await call<{ activated: boolean; providerRef?: string; amountMinor?: string; currency?: string }>('/api/membership', 'POST', { tier, currency: 'INR' });
    setBusy(false);
    if (!r.ok) return setMsg({ kind: 'err', text: r.message });
    if (r.data.activated) {
      setMsg({ kind: 'ok', text: `${tier} membership activated.` });
      router.refresh();
    } else if (r.data.providerRef) {
      setPending({ providerRef: r.data.providerRef, amount: r.data.amountMinor ?? '0' });
    }
  }

  async function paySandbox() {
    if (!pending) return;
    setBusy(true);
    const r = await call(`/api/payments/${pending.providerRef}/mock-pay`, 'POST');
    setBusy(false);
    if (!r.ok) return setMsg({ kind: 'err', text: r.message });
    setPending(null);
    setMsg({ kind: 'ok', text: 'Payment captured through the signed webhook. Membership updated.' });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiers.map((t) => (
          <button
            key={t.tier}
            className={`btn ${t.tier === currentTier ? 'btn-ghost' : 'btn-brand'} w-full flex-col py-4`}
            disabled={busy || t.tier === currentTier}
            onClick={() => choose(t.tier)}
          >
            <span>{t.tier === currentTier ? `Current: ${t.tier}` : `Choose ${t.tier}`}</span>
            <span className="text-xs font-semibold opacity-80">{t.price}</span>
          </button>
        ))}
      </div>
      {pending && (
        <div className="rounded-xl border border-orange-500/40 bg-orange-500/10 p-4">
          <p className="text-sm">Payment of {pending.amount} minor units is awaiting capture.</p>
          <button className="btn btn-brand mt-3" onClick={paySandbox} disabled={busy}>Pay (sandbox)</button>
          <p className="mt-2 text-xs text-orange-200/80">Sandbox only. Live payments use the configured gateway.</p>
        </div>
      )}
      {msg && <Message kind={msg.kind} text={msg.text} />}
    </div>
  );
}

// ---------- Binary placement ----------
export function PlacementForm({ options }: { options: { id: string; name: string; freeSides: ('LEFT' | 'RIGHT')[] }[] }) {
  const router = useRouter();
  const { busy, setBusy, msg, setMsg } = useBusy();
  const [parentId, setParentId] = useState(options[0]?.id ?? '');
  const [side, setSide] = useState<'LEFT' | 'RIGHT'>('LEFT');
  const selected = options.find((o) => o.id === parentId);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await call('/api/placement', 'POST', { parentId, side });
    setBusy(false);
    if (r.ok) { setMsg({ kind: 'ok', text: 'Placed in your binary tree.' }); router.refresh(); }
    else setMsg({ kind: 'err', text: r.message });
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
      <select className="input" value={parentId} onChange={(e) => setParentId(e.target.value)}>
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      <select className="input" value={side} onChange={(e) => setSide(e.target.value as 'LEFT' | 'RIGHT')}>
        {(selected?.freeSides ?? ['LEFT', 'RIGHT']).map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <button className="btn btn-brand" disabled={busy || !selected}>Place me</button>
      {msg && <div className="sm:col-span-3"><Message kind={msg.kind} text={msg.text} /></div>}
    </form>
  );
}

// ---------- Shop ----------
export function ShopItem({ productId, name, price, merchant }: { productId: string; name: string; price: string; merchant: string }) {
  const router = useRouter();
  const { busy, setBusy, msg, setMsg } = useBusy();
  const [coupon, setCoupon] = useState('');
  const [paymentRef, setPaymentRef] = useState<string | null>(null);

  async function buy() {
    setBusy(true); setMsg(null);
    const r = await call<{ paymentRef: string }>('/api/orders', 'POST', {
      items: [{ productId, quantity: 1 }],
      couponCode: coupon.trim() || null,
    });
    setBusy(false);
    if (!r.ok) return setMsg({ kind: 'err', text: r.message });
    setPaymentRef(r.data.paymentRef);
    setMsg({ kind: 'ok', text: 'Order created. Complete payment to confirm it.' });
    router.refresh();
  }

  async function pay() {
    if (!paymentRef) return;
    setBusy(true);
    const r = await call(`/api/payments/${paymentRef}/mock-pay`, 'POST');
    setBusy(false);
    if (!r.ok) return setMsg({ kind: 'err', text: r.message });
    setPaymentRef(null);
    setMsg({ kind: 'ok', text: 'Payment captured. The order is held in escrow until delivery and the return window close.' });
    router.refresh();
  }

  return (
    <div className="panel flex flex-col gap-3 p-5">
      <div className="text-xs uppercase tracking-widest text-[#a39a86]">{merchant}</div>
      <div className="text-lg font-bold">{name}</div>
      <div className="gold-text text-xl font-extrabold">{price}</div>
      <input className="input" placeholder="Cashback coupon (optional)" value={coupon} onChange={(e) => setCoupon(e.target.value)} maxLength={40} />
      {!paymentRef ? (
        <button className="btn btn-brand" onClick={buy} disabled={busy}>{busy ? 'Working…' : 'Buy now'}</button>
      ) : (
        <button className="btn btn-brand" onClick={pay} disabled={busy}>Pay (sandbox)</button>
      )}
      {msg && <Message kind={msg.kind} text={msg.text} />}
    </div>
  );
}

// ---------- Wallet ----------
export function ConvertForm({ currencies, balances }: { currencies: string[]; balances: Record<string, string> }) {
  const router = useRouter();
  const { busy, setBusy, msg, setMsg } = useBusy();
  const [from, setFrom] = useState('INR');
  const [to, setTo] = useState('USD');
  const [amount, setAmount] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await call('/api/wallet', 'POST', { from, to, amount });
    setBusy(false);
    if (r.ok) { setMsg({ kind: 'ok', text: 'Converted. Your new balances are shown above.' }); setAmount(''); router.refresh(); }
    else setMsg({ kind: 'err', text: r.message });
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
      <select className="input" value={from} onChange={(e) => setFrom(e.target.value)}>{currencies.map((c) => <option key={c}>{c}</option>)}</select>
      <select className="input" value={to} onChange={(e) => setTo(e.target.value)}>{currencies.map((c) => <option key={c}>{c}</option>)}</select>
      <input className="input" placeholder={`Amount (${balances[from] ?? '0'} available)`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
      <button className="btn btn-brand" disabled={busy || from === to}>Convert</button>
      {msg && <div className="sm:col-span-4"><Message kind={msg.kind} text={msg.text} /></div>}
    </form>
  );
}

export function WithdrawForm({ currencies }: { currencies: string[] }) {
  const router = useRouter();
  const { busy, setBusy, msg, setMsg } = useBusy();
  const [currency, setCurrency] = useState('INR');
  const [amount, setAmount] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await call('/api/withdrawals', 'POST', { currency, amount });
    setBusy(false);
    if (r.ok) { setMsg({ kind: 'ok', text: 'Withdrawal requested. Finance will review it.' }); setAmount(''); router.refresh(); }
    else setMsg({ kind: 'err', text: r.message });
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
      <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>{currencies.map((c) => <option key={c}>{c}</option>)}</select>
      <input className="input" placeholder="Amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
      <button className="btn btn-brand">Request withdrawal</button>
      {msg && <div className="sm:col-span-3"><Message kind={msg.kind} text={msg.text} /></div>}
    </form>
  );
}

// ---------- Ads ----------
export function AdWatch({ campaignId, durationSec, title, videoUrl }: { campaignId: string; durationSec: number; title: string; videoUrl: string }) {
  const router = useRouter();
  const { busy, setBusy, msg, setMsg } = useBusy();
  const [viewId, setViewId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  async function start() {
    setBusy(true); setMsg(null);
    const r = await call<{ viewId: string }>(`/api/ads/${campaignId}/start`, 'POST');
    setBusy(false);
    if (!r.ok) return setMsg({ kind: 'err', text: r.message });
    setViewId(r.data.viewId);
    setElapsed(0);
    // Watch timer runs in the browser; the server re-checks elapsed time on completion.
    timer.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  }

  async function complete() {
    if (!viewId) return;
    setBusy(true);
    const r = await call<{ rewardMinor: string; currency: string }>(`/api/ads/views/${viewId}/complete`, 'POST');
    setBusy(false);
    if (timer.current) clearInterval(timer.current);
    setViewId(null);
    if (!r.ok) return setMsg({ kind: 'err', text: r.message });
    setMsg({ kind: 'ok', text: `Reward credited to your wallet.` });
    router.refresh();
  }

  const pct = Math.min(100, Math.round((elapsed / durationSec) * 100));
  const ready = elapsed >= Math.ceil(durationSec * 0.95);
  return (
    <div className="space-y-3">
      {viewId ? (
        <>
          <video key={videoUrl} src={videoUrl} className="aspect-video w-full rounded-xl bg-black" muted playsInline controls={false} />
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#1c160d]">
            <div className="h-full bg-[linear-gradient(90deg,#ff6a00,#d4af37)] transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="text-xs text-[#a39a86]">{title}: {elapsed}s / {durationSec}s</div>
          <button className="btn btn-brand w-full" disabled={!ready || busy} onClick={complete}>
            {ready ? 'Claim reward' : 'Keep watching…'}
          </button>
        </>
      ) : (
        <button className="btn btn-brand w-full" disabled={busy} onClick={start}>Watch {title}</button>
      )}
      {msg && <Message kind={msg.kind} text={msg.text} />}
    </div>
  );
}

// ---------- Admin ----------
export function AdminButton({ url, body, label, method = 'POST', tone = 'brand', confirm: confirmText }: {
  url: string; body?: unknown; label: string; method?: 'POST' | 'PATCH' | 'PUT'; tone?: 'brand' | 'danger' | 'ghost'; confirm?: string;
}) {
  const router = useRouter();
  const { busy, setBusy, msg, setMsg } = useBusy();
  const cls = tone === 'danger' ? 'btn-danger' : tone === 'ghost' ? 'btn-ghost' : 'btn-brand';
  return (
    <div className="flex flex-col items-start gap-1">
      <button
        className={`btn ${cls} px-3 py-2 text-xs`}
        disabled={busy}
        onClick={async () => {
          if (confirmText && !window.confirm(confirmText)) return;
          setBusy(true); setMsg(null);
          const r = await call(url, method, body);
          setBusy(false);
          if (r.ok) { setMsg({ kind: 'ok', text: 'Done' }); router.refresh(); }
          else setMsg({ kind: 'err', text: r.message });
        }}
      >
        {busy ? '…' : label}
      </button>
      {msg && <span className={`text-xs ${msg.kind === 'ok' ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</span>}
    </div>
  );
}

export function AdminForm({ url, fields, submitLabel, method = 'POST', numeric = [], dates = [], extra = {} }: {
  url: string;
  fields: { name: string; label: string; type?: string; placeholder?: string; select?: string[] }[];
  submitLabel: string;
  method?: 'POST' | 'PATCH' | 'PUT';
  numeric?: string[];
  dates?: string[];
  extra?: Record<string, unknown>;
}) {
  const router = useRouter();
  const { busy, setBusy, msg, setMsg } = useBusy();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
    const data: Record<string, unknown> = { ...extra };
    for (const [k, v] of Object.entries(raw)) {
      if (v === '') continue;
      if (numeric.includes(k)) data[k] = Number(v);
      else if (dates.includes(k)) data[k] = new Date(v).toISOString();
      else data[k] = v;
    }
    setBusy(true); setMsg(null);
    const r = await call(url, method, data);
    setBusy(false);
    if (r.ok) { setMsg({ kind: 'ok', text: 'Saved' }); router.refresh(); e.currentTarget.reset(); }
    else setMsg({ kind: 'err', text: r.message });
  }
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      {fields.map((f) => (
        <div key={f.name}>
          <label className="label" htmlFor={`${url}-${f.name}`}>{f.label}</label>
          {f.select ? (
            <select id={`${url}-${f.name}`} name={f.name} className="input mt-1" required>
              {f.select.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <input id={`${url}-${f.name}`} name={f.name} type={f.type ?? 'text'} placeholder={f.placeholder} className="input mt-1" required />
          )}
        </div>
      ))}
      <div className="flex items-end"><button className="btn btn-brand w-full" disabled={busy}>{submitLabel}</button></div>
      {msg && <div className="sm:col-span-2"><Message kind={msg.kind} text={msg.text} /></div>}
    </form>
  );
}
