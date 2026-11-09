'use client';
import { useState } from 'react';
import { useT } from '@/components/region/region-context';

export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  const t = useT();
  return (
    <button
      className="btn btn-brand px-4 py-2 text-xs"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(`${window.location.origin}${text}`);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          setDone(false);
        }
      }}
    >
      {done ? t('common.copied') : t('common.copy')}
    </button>
  );
}
