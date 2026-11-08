import { describe, expect, it } from 'vitest';
import { milestoneProgress, nextMilestoneStatus, validateRule } from '@/lib/domain/milestones';

describe('milestone rules', () => {
  it('allows only the defined status transitions', () => {
    expect(nextMilestoneStatus('QUALIFIED', 'APPROVE')).toBe('APPROVED');
    expect(nextMilestoneStatus('QUALIFIED', 'REJECT')).toBe('REJECTED');
    expect(nextMilestoneStatus('APPROVED', 'FULFIL')).toBe('FULFILLED');
    expect(nextMilestoneStatus('APPROVED', 'REJECT')).toBeNull();
    expect(nextMilestoneStatus('REJECTED', 'APPROVE')).toBeNull();
    expect(nextMilestoneStatus('FULFILLED', 'FULFIL')).toBeNull();
    expect(nextMilestoneStatus('QUALIFIED', 'FULFIL')).toBeNull();
  });

  it('reports progress and caps it at 100 percent once reached', () => {
    expect(milestoneProgress(2_500_000n, 5_000_000n)).toEqual({ percent: 50, reached: false });
    expect(milestoneProgress(5_000_000n, 5_000_000n)).toEqual({ percent: 100, reached: true });
    expect(milestoneProgress(9_000_000n, 5_000_000n)).toEqual({ percent: 100, reached: true });
    expect(milestoneProgress(0n, 0n)).toEqual({ percent: 0, reached: false });
  });

  it('validates a rule edit', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const ok = validateRule({ name: 'Retail', thresholdRupees: '50000', startsAt: start, endsAt: null });
    expect(ok.errors).toEqual([]);
    expect(ok.thresholdMinor).toBe(5_000_000n);

    expect(validateRule({ name: '', thresholdRupees: '50000', startsAt: start, endsAt: null }).errors).toContain('Name is required');
    expect(validateRule({ name: 'x', thresholdRupees: '0', startsAt: start, endsAt: null }).errors).toContain('Threshold must be greater than zero');
    expect(validateRule({ name: 'x', thresholdRupees: 'abc', startsAt: start, endsAt: null }).errors[0]).toMatch(/Threshold/);
    expect(validateRule({ name: 'x', thresholdRupees: '1', startsAt: start, endsAt: new Date('2025-12-31') }).errors).toContain('End date must be after the start date');
  });
});
