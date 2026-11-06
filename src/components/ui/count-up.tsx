'use client';

import { useEffect, useRef, useState } from 'react';

import { formatINRCompact } from '@/lib/format';

/**
 * Counts from 0 to `value` once it scrolls into view. Respects reduced-motion preferences.
 * `mode` is a plain string on purpose: functions cannot be passed from server to client components.
 */
export function CountUp({ value, mode = 'number', duration = 1400 }: { value: number; mode?: 'number' | 'inrCompactRupees'; duration?: number }) {
  const [shown, setShown] = useState(0);
  const format = (n: number) => (mode === 'inrCompactRupees' ? formatINRCompact(n * 100) : n.toLocaleString('en-IN'));
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    const run = () => {
      if (reduce) return setShown(value);
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        run();
        io.disconnect();
      }
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, duration]);

  return <span ref={ref}>{format(shown)}</span>;
}
