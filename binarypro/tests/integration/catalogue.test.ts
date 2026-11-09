import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/server/db';
import { createService, updateService, listServices } from '@/lib/server/catalogue';
import { makeUser, resetDb } from './helpers';
import { can } from '@/lib/domain/rbac';

const base = { name: 'Home visit', description: 'In-home consultation', priceRupees: '499', currency: 'INR' as const, reason: 'Launch price' };

describe('service catalogue', () => {
  beforeEach(resetDb);

  it('creates a service with an exact price and an audit record that names the reason', async () => {
    const admin = await makeUser({ name: 'Owner', role: 'ADMIN' });
    const s = await createService(base, admin.id);
    expect(s.priceMinor).toBe(49_900n);
    expect(await db.auditLog.count({ where: { action: 'service.created', targetId: s.id } })).toBe(1);
    expect((await listServices()).map((x) => x.name)).toEqual(['Home visit']);
  });

  it('keeps the history of a price change and refuses zero prices and missing reasons', async () => {
    const admin = await makeUser({ name: 'Owner', role: 'ADMIN' });
    const s = await createService(base, admin.id);
    await updateService(s.id, { ...base, priceRupees: '599.50', reason: 'Price review', active: true }, admin.id);
    const log = await db.auditLog.findFirstOrThrow({ where: { action: 'service.updated', targetId: s.id } });
    expect((log.meta as { before: { price: string } }).before.price).toBe('49900');
    await expect(createService({ ...base, priceRupees: '0' }, admin.id)).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(createService({ ...base, reason: 'x' }, admin.id)).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('allows only administrators to manage the catalogue', () => {
    expect(can('ADMIN', 'catalogue:manage')).toBe(true);
    expect(can('FINANCE', 'catalogue:manage')).toBe(false);
    expect(can('MERCHANT', 'catalogue:manage')).toBe(false);
    expect(can('MEMBER', 'catalogue:manage')).toBe(false);
  });
});
