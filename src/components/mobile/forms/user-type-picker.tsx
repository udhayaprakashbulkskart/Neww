'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client/api';
import { Icon } from '@/components/ui/icons';
import { Notice } from '@/components/ui/primitives';

type Choice = 'BENEFICIARY' | 'DONOR';

export function UserTypePicker() {
  const router = useRouter();
  const [choice, setChoice] = useState<Choice | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!choice) return;
    setBusy(true);
    setError(null);
    const res = await api('/api/profile', { method: 'PATCH', body: { userType: choice } });
    setBusy(false);
    if (!res.ok) return setError(res.message);
    router.replace(choice === 'BENEFICIARY' ? '/app/create' : '/app/home');
    router.refresh();
  }

  const options: { key: Choice; title: string; body: string; icon: 'users' | 'heart'; tone: string }[] = [
    { key: 'BENEFICIARY', title: 'I Need Help', body: 'Create a verified campaign and receive support.', icon: 'users', tone: 'border-mint/40 bg-mint/[0.06]' },
    { key: 'DONOR', title: 'I Want to Support', body: 'Help people in genuine need by donating.', icon: 'heart', tone: 'border-pastel-pink/30 bg-pastel-pink/[0.05]' },
  ];

  return (
    <div className="mt-8 space-y-4">
      {options.map((o) => {
        const active = choice === o.key;
        return (
          <button
            type="button"
            key={o.key}
            onClick={() => setChoice(o.key)}
            aria-pressed={active}
            className={`flex w-full items-center gap-4 rounded-[28px] border p-5 text-left transition duration-200 ${o.tone} ${active ? 'ring-2 ring-mint shadow-glow' : 'hover:bg-white/[0.03]'}`}
          >
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-ink-950/60 text-mint">
              <Icon name={o.icon} className="h-7 w-7" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-bold">{o.title}</span>
              <span className="mt-1 block text-sm leading-snug text-ui-muted">{o.body}</span>
            </span>
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${active ? 'border-mint bg-mint text-ink-950' : 'border-white/20'}`}>
              {active && <Icon name="check" className="h-4 w-4" strokeWidth={3} />}
            </span>
          </button>
        );
      })}

      <p className="px-1 pt-2 text-xs leading-relaxed text-ui-subtle">
        You can do both later. Creating a campaign adds beneficiary tools to your account.
      </p>
      {error && <Notice tone="error">{error}</Notice>}
      <button type="button" disabled={!choice || busy} onClick={save} className="btn-primary mt-4 w-full">
        {busy ? 'Saving…' : 'Continue'}
      </button>
    </div>
  );
}
