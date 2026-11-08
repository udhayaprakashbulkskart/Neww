'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { segmentCentreDeg, spinRotation } from '@/lib/domain/spin';
import { formatMoney } from '@/lib/domain/money';

export interface WheelSegment {
  slotId: string;
  name: string;
  description: string;
  kind: 'BADGE' | 'CASH' | 'VOUCHER';
  amountMinor: string;
  weight: number;
}

export interface SpinViewState {
  eligible: boolean;
  reason: string;
  reasonText: string;
  nextEligibleAt: string | null;
  serverNow: string;
  previewOnly: boolean;
  cooldownDays: number;
}

interface SpinResult {
  rewardName: string;
  rewardDescription: string;
  kind: 'BADGE' | 'CASH' | 'VOUCHER';
  amountMinor: string;
  outcome: string;
  slotIndex: number;
  wheelSize: number;
  nextEligibleAt: string;
}

const PALETTE: { fill: string; text: string }[] = [
  { fill: '#2a1d06', text: '#ffe9a6' },
  { fill: '#d4af37', text: '#140e02' },
  { fill: '#1a1408', text: '#ffe9a6' },
  { fill: '#f0cf6a', text: '#140e02' },
  { fill: '#3a2808', text: '#ffe9a6' },
  { fill: '#e6bf4f', text: '#140e02' },
];
const SPIN_MS = 5200;

function polar(r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: 100 + r * Math.sin(rad), y: 100 - r * Math.cos(rad) };
}

function slicePath(i: number, n: number) {
  const a0 = (i * 360) / n;
  const a1 = ((i + 1) * 360) / n;
  const p0 = polar(96, a0);
  const p1 = polar(96, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M100,100 L${p0.x},${p0.y} A96,96 0 ${large} 1 ${p1.x},${p1.y} Z`;
}

function remainingMs(nextIso: string | null, offsetMs: number): number {
  if (!nextIso) return 0;
  return Math.max(0, new Date(nextIso).getTime() - (Date.now() + offsetMs));
}

function formatCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return d > 0 ? `${d}d ${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function kindNote(kind: string, amountMinor: string) {
  if (kind === 'CASH') return `${formatMoney(BigInt(amountMinor), 'INR')} has been credited to your wallet.`;
  if (kind === 'VOUCHER') return 'Your voucher request is with our team. The voucher code appears in your reward history once issued.';
  return 'Added to your badges on your profile.';
}

export function SpinWheel({ segments, state }: { segments: WheelSegment[]; state: SpinViewState }) {
  const router = useRouter();
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  // Client clock is only used to draw the countdown. The server decides when a spin is allowed.
  const offsetRef = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    offsetRef.current = new Date(state.serverNow).getTime() - Date.now();
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state.serverNow]);

  const remaining = remainingMs(state.nextEligibleAt, offsetRef.current);
  const cooling = !state.eligible && state.reason === 'COOLDOWN' && remaining > 0;
  useEffect(() => {
    if (state.reason === 'COOLDOWN' && now > 0 && remaining <= 0) router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  const n = segments.length;
  const labels = useMemo(() => segments.map((s, i) => {
    const c = segmentCentreDeg(i, n);
    const p = polar(60, c);
    // Labels in the lower half are turned round so they read upright.
    const flip = c > 90 && c < 270;
    return { ...p, rot: flip ? c + 180 : c, name: s.name.length > 16 ? `${s.name.slice(0, 15)}…` : s.name, kind: s.kind, i };
  }), [segments, n]);

  async function requestSpin(key: string, attempt = 0): Promise<SpinResult> {
    try {
      const res = await fetch('/api/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
        credentials: 'same-origin',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(json?.error?.message ?? `Spin failed (${res.status})`), { status: res.status });
      return json as SpinResult;
    } catch (err) {
      // A network failure is retried with the same key, so the server can never spin twice.
      if (!(err as { status?: number }).status && attempt < 2) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        return requestSpin(key, attempt + 1);
      }
      throw err;
    }
  }

  async function onSpin() {
    if (spinning || !state.eligible || n === 0) return;
    setMessage(null);
    setSpinning(true);
    const key = crypto.randomUUID().replace(/-/g, '') + Date.now().toString(36);
    try {
      const r = await requestSpin(key);
      // Animate to the server's chosen segment. The server result is the only one that is shown.
      const size = r.wheelSize > 0 ? r.wheelSize : n;
      const index = r.slotIndex >= 0 ? r.slotIndex % size : Math.floor(Math.random() * size);
      setRotation((prev) => spinRotation(prev, index, size, 6));
      timer.current = setTimeout(() => {
        setSpinning(false);
        setResult(r);
      }, SPIN_MS);
    } catch (err) {
      setSpinning(false);
      setMessage((err as Error).message);
      router.refresh();
    }
  }

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function closePopup() {
    setResult(null);
    router.refresh();
  }

  const disabledReason = state.previewOnly
    ? 'Join a paid membership to spin. You can see the wheel for free.'
    : cooling
      ? `Next spin in ${formatCountdown(remaining)}`
      : !state.eligible
        ? state.reasonText
        : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
      <div className="relative mx-auto aspect-square w-full max-w-[460px]">
        {/* pointer */}
        <div className="absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-2" aria-hidden="true">
          <svg viewBox="0 0 40 44" className="h-11 w-9 drop-shadow-[0_4px_10px_rgba(255,190,60,.8)]"><path d="M20 44 L3 8 Q20 -4 37 8 Z" fill="url(#pointerGold)" stroke="#fff3c4" strokeWidth="1.5" /><defs><linearGradient id="pointerGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff1b0" /><stop offset="1" stopColor="#c8961e" /></linearGradient></defs></svg>
        </div>
        {/* golden rim */}
        <div className="spin-glow absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,#f7e09a,#b8860b,#fff3c4,#b8860b,#f7e09a)] p-[10px]">
          <div className="relative h-full w-full overflow-hidden rounded-full bg-black">
            <div
              className="absolute inset-0"
              style={{ transform: `rotate(${rotation}deg)`, transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(.17,.67,.16,1)` : 'none' }}
            >
              <svg viewBox="0 0 200 200" className="h-full w-full" role="img" aria-label="Spin wheel">
                {segments.map((s, i) => (
                  <path key={s.slotId} d={slicePath(i, n)} fill={PALETTE[i % PALETTE.length]!.fill} stroke="#8a6a1c" strokeWidth="0.6" />
                ))}
                {labels.map((l) => (
                  <text
                    key={l.i}
                    x={l.x}
                    y={l.y}
                    fontSize={n > 6 ? 6 : 7.5}
                    fontWeight={700}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={PALETTE[l.i % PALETTE.length]!.text}
                    transform={`rotate(${l.rot} ${l.x} ${l.y})`}
                  >
                    {l.name}
                  </text>
                ))}
              </svg>
            </div>
          </div>
        </div>
        {/* centre button */}
        <button
          type="button"
          onClick={onSpin}
          disabled={spinning || !state.eligible || n === 0}
          className="absolute left-1/2 top-1/2 z-10 grid h-24 w-24 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-[#fff3c4] bg-[radial-gradient(circle_at_35%_30%,#fff3c4,#d4af37_45%,#7a5a12)] text-sm font-black tracking-[.2em] text-black shadow-[0_0_40px_rgba(255,190,60,.7)] transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 sm:h-28 sm:w-28"
          aria-label={state.eligible ? 'Spin the wheel' : 'Spin unavailable'}
        >
          {spinning ? '…' : 'SPIN'}
        </button>
      </div>

      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-bold">Spin & Win</h2>
          <p className="mt-1 text-sm text-[#a39a86]">One spin every {state.cooldownDays} days for paid members. Rewards are chosen on our server when you press SPIN.</p>
        </div>
        {disabledReason && (
          <div className="rounded-2xl border border-[#d4af37]/30 bg-[#d4af37]/5 px-4 py-3 text-sm text-[#f7e09a]" role="status">
            {disabledReason}
            {cooling && <div className="mt-1 font-mono text-2xl font-black text-white" aria-live="off">{formatCountdown(remaining)}</div>}
          </div>
        )}
        {message && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{message}</div>}
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[.2em] text-[#f7e09a]">On your wheel</div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {segments.map((s) => (
              <li key={s.slotId} className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                <div className="text-sm font-semibold">{s.name}</div>
                <div className="text-xs text-[#8f8672]">{s.description}</div>
              </li>
            ))}
          </ul>
          {n === 0 && <p className="text-sm text-[#8f8672]">No rewards are live on this wheel right now.</p>}
        </div>
      </div>

      {result && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="spin-result-title">
          <div className="spin-pop spin-shine relative w-full max-w-sm overflow-hidden rounded-3xl border border-[#d4af37]/50 bg-[linear-gradient(160deg,#2a1d06,#070707)] p-7 text-center shadow-[0_0_80px_rgba(255,190,60,.45)]">
            <div className="text-xs font-semibold uppercase tracking-[.3em] text-[#f7e09a]">You won</div>
            <h3 id="spin-result-title" className="mt-3 text-3xl font-black text-white">{result.rewardName}</h3>
            <p className="mt-2 text-sm text-[#cfc6b0]">{result.rewardDescription}</p>
            <p className="mt-3 text-sm font-semibold text-[#f7e09a]">{kindNote(result.kind, result.amountMinor)}</p>
            <button type="button" onClick={closePopup} className="btn btn-brand mt-6 w-full py-3">Continue</button>
          </div>
        </div>
      )}
    </div>
  );
}
