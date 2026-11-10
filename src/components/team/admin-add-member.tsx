'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { teamApi } from '@/lib/team/client';
import { btnPrimary, card, inputBase, Notice } from './ui';

const EMPTY = { fullName: '', phone: '', password: '', jobTitle: '', role: 'MEMBER' as 'MEMBER' | 'ADMIN' };

export function AdminAddMember() {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      await teamApi('/api/team/members', { body: form });
      setDone(`${form.fullName} has been added. Share the phone number and temporary password with them securely.`);
      setForm(EMPTY);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the member.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={`${card} space-y-5 p-6`}>
      <div>
        <h2 className="text-lg font-bold">Add a team member</h2>
        <p className="text-sm text-tp-muted">They sign in with their full name, phone number and password. They join the Team Group automatically.</p>
      </div>
      {error && <Notice>{error}</Notice>}
      {done && <Notice tone="success">{done}</Notice>}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Full name">
          <input className={inputBase} required minLength={2} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        </Field>
        <Field label="Phone number">
          <input className={inputBase} required inputMode="tel" placeholder="+91 98765 43210" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="Job title">
          <input className={inputBase} value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
        </Field>
        <Field label="Temporary password">
          <input className={inputBase} type="password" required minLength={10} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <Field label="Role">
          <select className={inputBase} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'MEMBER' | 'ADMIN' })}>
            <option value="MEMBER">Team member</option>
            <option value="ADMIN">Administrator</option>
          </select>
        </Field>
      </div>
      <button type="submit" disabled={busy} className={btnPrimary}>
        {busy ? 'Adding…' : 'Add member'}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-tp-muted">{label}</span>
      {children}
    </label>
  );
}
