import { beforeEach, describe, expect, it } from 'vitest';
import { engineExportTable, engineCsv, engineOverview } from '@/lib/server/engine-admin';
import { publishPolicy, setDailyCap } from '@/lib/server/commission-engine';
import { reconcileAndStore } from './engine-helpers';
import { makeUser, resetDb } from './helpers';
import { can } from '@/lib/domain/rbac';

describe('financial engine exports and overview', () => {
  beforeEach(resetDb);

  it('exports pending, volume, refunds, settlements and reconciliation as Excel-ready CSV', async () => {
    const ops = await makeUser({ name: 'Owner', role: 'ADMIN' });
    await setDailyCap('5000', 'Test cap', ops.id);
    await publishPolicy({ kind: 'PRODUCT', rateBps: 500, active: true, legalApprovalRef: 'LEGAL-APPROVED-0009', reason: 'Export test policy' }, ops.id);
    await reconcileAndStore(ops.id, 'Export test run');
    for (const report of ['pending', 'volume', 'refunds', 'settlements', 'reconciliation'] as const) {
      const table = await engineExportTable(report, '2026-11-01', '2026-11-30');
      const csv = engineCsv(table);
      expect(csv.startsWith('﻿')).toBe(true);
      expect(csv).toContain(table.headers[0]!);
    }
    const recon = await engineExportTable('reconciliation', '2026-11-01', '2026-11-30');
    expect(recon.rows.length).toBeGreaterThan(0);
  });

  it('overview reports the cap, the policy versions and the latest reconciliation', async () => {
    const ops = await makeUser({ name: 'Owner', role: 'ADMIN' });
    await setDailyCap('5000', 'Test cap', ops.id);
    for (const kind of ['PRODUCT', 'SERVICE', 'DIRECT_SPONSOR', 'BINARY'] as const) {
      await publishPolicy({ kind, rateBps: 0, active: false, reason: 'Inactive starting version' }, ops.id);
    }
    await reconcileAndStore(ops.id, 'Overview test run');
    const o = await engineOverview();
    expect(o.capMinor).toBe(500_000n);
    expect(o.policies.map((p) => p.kind).sort()).toEqual(['BINARY', 'DIRECT_SPONSOR', 'PRODUCT', 'SERVICE'].sort());
    expect(o.reports[0]!.status).toBe('PASS');
  });

  it('keeps engine powers with administrators, and gives finance read-only access', () => {
    for (const p of ['engine:manage', 'catalogue:manage'] as const) {
      expect(can('ADMIN', p)).toBe(true);
      expect(can('FINANCE', p)).toBe(false);
      expect(can('SUPPORT', p)).toBe(false);
      expect(can('MEMBER', p)).toBe(false);
    }
    expect(can('FINANCE', 'engine:read')).toBe(true);
    expect(can('SUPPORT', 'engine:read')).toBe(false);
  });
});
