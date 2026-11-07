'use client';
import { useState } from 'react';

export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
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
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}
