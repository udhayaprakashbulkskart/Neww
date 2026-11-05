'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client/api';
import { Notice } from '@/components/ui/primitives';
import { Field } from '@/components/wizard/forms';

type Initial = {
  fullName: string;
  email: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  occupation: string;
  notifyEmail: boolean;
  notifySms: boolean;
  notifyWhatsapp: boolean;
};

export function SettingsForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const set = (k: keyof Initial) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy('save');
    setMsg(null);
    const body: Record<string, unknown> = {
      fullName: v.fullName,
      addressLine: v.addressLine || undefined,
      city: v.city || undefined,
      state: v.state || undefined,
      pincode: v.pincode || undefined,
      occupation: v.occupation || undefined,
      notifyEmail: v.notifyEmail,
      notifySms: v.notifySms,
      notifyWhatsapp: v.notifyWhatsapp,
    };
    if (v.email && v.email !== initial.email) body.email = v.email;
    const res = await api('/api/profile', { method: 'PATCH', body });
    setBusy(null);
    if (!res.ok) return setMsg({ tone: 'error', text: res.message });
    setMsg({ tone: 'success', text: 'Settings saved.' });
    router.refresh();
  }

  async function signOut(everywhere: boolean) {
    setBusy(everywhere ? 'all' : 'out');
    await api(everywhere ? '/api/auth/signout-all' : '/api/auth/logout', { body: {} });
    window.location.assign('/app');
  }

  async function requestDeletion() {
    if (!window.confirm('Request deletion of your account? We will confirm by SMS. Records the law requires us to keep will be retained.')) return;
    setBusy('delete');
    const res = await api('/api/profile/delete-request', { body: {} });
    setBusy(null);
    setMsg(res.ok ? { tone: 'success', text: 'Request received. Our team will contact you within the timelines set by the DPDP Act.' } : { tone: 'error', text: res.message });
  }

  return (
    <div className="space-y-8">
      <form onSubmit={save} className="space-y-5" noValidate>
        <h2 className="text-[17px] font-semibold">Profile</h2>
        <Field id="fullName" label="Full name" value={v.fullName} onChange={set('fullName')} autoComplete="name" />
        <Field id="email" label="Email (optional)" value={v.email} onChange={set('email')} type="email" autoComplete="email" />
        <Field id="addressLine" label="Address" value={v.addressLine} onChange={set('addressLine')} />
        <div className="grid grid-cols-2 gap-4">
          <Field id="city" label="City" value={v.city} onChange={set('city')} />
          <Field id="state" label="State" value={v.state} onChange={set('state')} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field id="pincode" label="Pincode" value={v.pincode} onChange={set('pincode')} inputMode="numeric" maxLength={6} />
          <Field id="occupation" label="Occupation" value={v.occupation} onChange={set('occupation')} />
        </div>

        <fieldset className="space-y-3">
          <legend className="mb-2 text-[17px] font-semibold">Notifications</legend>
          {(
            [
              ['notifySms', 'SMS alerts for donations and campaign status'],
              ['notifyEmail', 'Email updates'],
              ['notifyWhatsapp', 'WhatsApp updates (when available)'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="surface-flat flex cursor-pointer items-center justify-between gap-4 p-4 text-sm">
              <span>{label}</span>
              <input type="checkbox" className="h-5 w-5 accent-[#5CFFB1]" checked={v[key]} onChange={(e) => setV({ ...v, [key]: e.target.checked })} />
            </label>
          ))}
        </fieldset>

        {msg && <Notice tone={msg.tone === 'success' ? 'success' : 'error'}>{msg.text}</Notice>}
        <button type="submit" disabled={busy !== null} className="btn-primary w-full">
          {busy === 'save' ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      <section className="space-y-3" aria-labelledby="acc-h">
        <h2 id="acc-h" className="text-[17px] font-semibold">
          Account
        </h2>
        <button type="button" disabled={busy !== null} onClick={() => signOut(false)} className="btn-ghost w-full">
          Sign out
        </button>
        <button type="button" disabled={busy !== null} onClick={() => signOut(true)} className="btn-ghost w-full">
          Sign out of all devices
        </button>
        <button type="button" disabled={busy !== null} onClick={requestDeletion} className="btn-danger w-full">
          Request account deletion
        </button>
      </section>
    </div>
  );
}
