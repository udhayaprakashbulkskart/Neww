'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { RegisterForm } from './signup-form';
import { useRegion, useT } from '@/components/region/region-context';
import { formatMoney } from '@/lib/domain/money';
import { numberLocale } from '@/lib/i18n/locales';

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
  const t = useT();
  const [mode, setMode] = useState<'signin' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, setBusy, msg, setMsg } = useBusy();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await call('/api/auth/login', 'POST', { email, password });
    setBusy(false);
    if (r.ok) router.push('/dashboard');
    else setMsg({ kind: 'err', text: r.message });
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-black/60 p-1 text-sm ring-1 ring-white/5">
        {(['signin', 'register'] as const).map((m) => (
          <button key={m} type="button" onClick={() => { setMode(m); setMsg(null); }}
            className={`rounded-xl py-2.5 font-semibold transition ${mode === m ? 'bg-[linear-gradient(135deg,#ff6a00,#d4af37)] text-black shadow-[0_6px_20px_rgba(255,106,0,.3)]' : 'text-[#a39a86] hover:text-white'}`}>
            {m === 'signin' ? t('common.signIn') : t('auth.createTab')}
          </button>
        ))}
      </div>
      {mode === 'register' ? (
        <RegisterForm ref={ref} />
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="label" htmlFor="email">{t('auth.emailLabel')}</label>
            <input id="email" type="email" className="input mt-2" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div>
            <label className="label" htmlFor="password">{t('auth.passwordLabel')}</label>
            <input id="password" type="password" className="input mt-2" value={password} onChange={(e) => setPassword(e.target.value)} required maxLength={128} autoComplete="current-password" />
          </div>
          <button className="btn btn-brand w-full py-3.5" disabled={busy}>{busy ? t('auth.pleaseWait') : t('common.signIn')}</button>
          {msg && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{msg.text}</div>}
        </form>
      )}
    </div>
  );
}

export function LogoutButton({ compact = false }: { compact?: boolean } = {}) {
  const router = useRouter();
  const t = useT();
  return (
    <button
      className={compact ? 'btn btn-ghost whitespace-nowrap px-2.5 py-1.5 text-[11px]' : 'btn btn-ghost px-3 py-2 text-xs'}
      onClick={async () => {
        await call('/api/auth/logout', 'POST');
        router.push('/login');
        router.refresh();
      }}
    >
      {t('common.signOut')}
    </button>
  );
}

// ---------- Membership checkout ----------
export function MembershipPicker({ currentTier, tiers }: { currentTier: string; tiers: { tier: string; price: string }[] }) {
  const router = useRouter();
  const { t: tr, locale } = useRegion();
  const { busy, setBusy, msg, setMsg } = useBusy();
  const [pending, setPending] = useState<{ providerRef: string; amount: string } | null>(null);

  async function choose(tier: string) {
    setBusy(true); setMsg(null);
    const r = await call<{ activated: boolean; providerRef?: string; amountMinor?: string; currency?: string }>('/api/membership', 'POST', { tier, currency: 'INR' });
    setBusy(false);
    if (!r.ok) return setMsg({ kind: 'err', text: r.message });
    if (r.data.activated) {
      setMsg({ kind: 'ok', text: tr('membership.activated', { tier }) });
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
    setMsg({ kind: 'ok', text: tr('membership.captured') });
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
            <span>{t.tier === currentTier ? tr('membership.currentTier', { tier: tr(`tier.${t.tier}` as 'tier.BASIC') }) : tr('membership.chooseTier', { tier: tr(`tier.${t.tier}` as 'tier.BASIC') })}</span>
            <span className="text-xs font-semibold opacity-80">{t.price}</span>
          </button>
        ))}
      </div>
      {pending && (
        <div className="rounded-xl border border-orange-500/40 bg-orange-500/10 p-4">
          <p className="text-sm">{tr('membership.awaiting', { amount: formatMoney(BigInt(pending.amount), 'INR', numberLocale(locale, 'INR')) })}</p>
          <button className="btn btn-brand mt-3" onClick={paySandbox} disabled={busy}>{tr('membership.paySandbox')}</button>
          <p className="mt-2 text-xs text-orange-200/80">{tr('membership.sandboxNote')}</p>
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
export function ShopItem({ productId, name, price }: { productId: string; name: string; price: string }) {
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
    setMsg({ kind: 'ok', text: 'Order placed. Complete payment to confirm it.' });
    router.refresh();
  }

  async function pay() {
    if (!paymentRef) return;
    setBusy(true);
    const r = await call(`/api/payments/${paymentRef}/mock-pay`, 'POST');
    setBusy(false);
    if (!r.ok) return setMsg({ kind: 'err', text: r.message });
    setPaymentRef(null);
    setMsg({ kind: 'ok', text: 'Payment received. Your order is held until delivery and the return window close.' });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-base font-bold leading-snug">{name}</h3>
        <span className="shrink-0 font-extrabold text-[#f7e09a]">{price}</span>
      </div>
      <input className="input text-sm" placeholder="Cashback coupon code (optional)" aria-label="Coupon code" value={coupon} onChange={(e) => setCoupon(e.target.value)} maxLength={40} />
      {!paymentRef ? (
        <button className="btn btn-brand w-full py-3" onClick={buy} disabled={busy}>{busy ? 'Placing order…' : 'Buy now'}</button>
      ) : (
        <button className="btn btn-brand w-full py-3" onClick={pay} disabled={busy}>{busy ? 'Processing…' : 'Pay now (sandbox)'}</button>
      )}
      {msg && <Message kind={msg.kind} text={msg.text} />}
    </div>
  );
}

// ---------- Wallet ----------
export function ConvertForm({ currencies, balances }: { currencies: string[]; balances: Record<string, string> }) {
  const router = useRouter();
  const t = useT();
  const { busy, setBusy, msg, setMsg } = useBusy();
  const [from, setFrom] = useState('INR');
  const [to, setTo] = useState('USD');
  const [amount, setAmount] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await call('/api/wallet', 'POST', { from, to, amount });
    setBusy(false);
    if (r.ok) { setMsg({ kind: 'ok', text: t('wallet.convertedOk') }); setAmount(''); router.refresh(); }
    else setMsg({ kind: 'err', text: r.message });
  }

  return (
    <form onSubmit={submit} className="grid min-w-0 grid-cols-2 gap-3">
      <div className="min-w-0"><label className="label">{t('wallet.from')}</label><select className="input mt-1.5" value={from} onChange={(e) => setFrom(e.target.value)}>{currencies.map((c) => <option key={c}>{c}</option>)}</select></div>
      <div className="min-w-0"><label className="label">{t('wallet.to')}</label><select className="input mt-1.5" value={to} onChange={(e) => setTo(e.target.value)}>{currencies.map((c) => <option key={c}>{c}</option>)}</select></div>
      <div className="col-span-2"><label className="label">{t('wallet.amount')}</label><input className="input mt-1.5" placeholder={t('wallet.availableAmount', { amount: balances[from] ?? '0' })} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
      <button className="btn btn-brand col-span-2 py-3" disabled={busy || from === to}>{busy ? t('wallet.converting') : t('wallet.convertButton')}</button>
      {msg && <div className="col-span-2"><Message kind={msg.kind} text={msg.text} /></div>}
    </form>
  );
}

export function WithdrawForm({ currencies }: { currencies: string[] }) {
  const router = useRouter();
  const t = useT();
  const { busy, setBusy, msg, setMsg } = useBusy();
  const [currency, setCurrency] = useState('INR');
  const [amount, setAmount] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await call('/api/withdrawals', 'POST', { currency, amount });
    setBusy(false);
    if (r.ok) { setMsg({ kind: 'ok', text: t('wallet.requestedOk') }); setAmount(''); router.refresh(); }
    else setMsg({ kind: 'err', text: r.message });
  }

  return (
    <form onSubmit={submit} className="grid min-w-0 grid-cols-2 gap-3">
      <div className="min-w-0"><label className="label">{t('wallet.currency')}</label><select className="input mt-1.5" value={currency} onChange={(e) => setCurrency(e.target.value)}>{currencies.map((c) => <option key={c}>{c}</option>)}</select></div>
      <div className="min-w-0"><label className="label">{t('wallet.amount')}</label><input className="input mt-1.5" placeholder="0.00" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
      <button className="btn btn-brand col-span-2 py-3">{busy ? t('wallet.submitting') : t('wallet.requestButton')}</button>
      {msg && <div className="col-span-2"><Message kind={msg.kind} text={msg.text} /></div>}
    </form>
  );
}

// ---------- Ads ----------
export function AdWatch({ campaignId, durationSec, title }: { campaignId: string; durationSec: number; title: string; videoUrl?: string }) {
  const router = useRouter();
  const { busy, setBusy, msg, setMsg } = useBusy();
  const [viewId, setViewId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const required = Math.ceil(durationSec * 0.95);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  async function start() {
    setBusy(true); setMsg(null);
    const r = await call<{ viewId: string }>(`/api/ads/${campaignId}/start`, 'POST');
    setBusy(false);
    if (!r.ok) return setMsg({ kind: 'err', text: r.message });
    setViewId(r.data.viewId);
    setElapsed(0);
    // The timer runs in the browser for display; the server checks real elapsed time when you claim.
    timer.current = setInterval(() => setElapsed((s) => Math.min(s + 1, durationSec)), 1000);
  }

  async function claim() {
    if (!viewId) return;
    setBusy(true);
    const r = await call<{ rewardMinor: string; currency: string }>(`/api/ads/views/${viewId}/complete`, 'POST');
    setBusy(false);
    if (timer.current) clearInterval(timer.current);
    setViewId(null);
    if (!r.ok) return setMsg({ kind: 'err', text: r.message });
    setMsg({ kind: 'ok', text: 'Reward added to your wallet.' });
    router.refresh();
  }

  const ready = viewId !== null && elapsed >= required;
  const remaining = Math.max(0, durationSec - elapsed);
  const R = 26;
  const C = 2 * Math.PI * R;
  const progress = viewId ? Math.min(1, elapsed / durationSec) : 0;

  return (
    <div className="space-y-4">
      {viewId ? (
        <>
          <div className="flex items-center gap-4 rounded-2xl border border-white/5 bg-black/50 p-4">
            <div className="relative grid h-16 w-16 shrink-0 place-items-center">
              <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90" aria-hidden="true">
                <circle cx="32" cy="32" r={R} stroke="#1c160d" strokeWidth="6" fill="none" />
                <circle cx="32" cy="32" r={R} stroke="url(#ad-grad)" strokeWidth="6" fill="none" strokeLinecap="round"
                  strokeDasharray={C} strokeDashoffset={C * (1 - progress)} className="transition-[stroke-dashoffset] duration-1000" />
                <defs><linearGradient id="ad-grad" x1="0" x2="1"><stop offset="0" stopColor="#ff6a00" /><stop offset="1" stopColor="#d4af37" /></linearGradient></defs>
              </svg>
              <span className="text-sm font-black tabular-nums">{remaining}s</span>
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{title}</div>
              <div className="text-xs text-[#8f8672]">{ready ? 'Watched in full. You can claim your reward.' : `Keep watching. Claim unlocks at ${required}s.`}</div>
            </div>
          </div>
          <button className="btn btn-brand w-full py-3" disabled={!ready || busy} onClick={claim}>
            {busy ? 'Claiming…' : ready ? 'Claim reward' : 'Watching…'}
          </button>
        </>
      ) : (
        <button className="btn btn-brand w-full py-3" disabled={busy} onClick={start}>{busy ? 'Starting…' : 'Start watching'}</button>
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
