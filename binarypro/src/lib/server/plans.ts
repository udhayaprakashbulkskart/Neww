// Membership catalogue: read effective plans and update them (admin only), with an audit entry per change.
import { db, type Tx } from './db';
import { DomainError } from './errors';
import { audit } from './audit';
import { TIERS, type Tier } from '@/lib/domain/plans';
import { mergePlan, validatePlanUpdate, type EffectivePlan, type PlanRow, type PlanUpdate } from '@/lib/domain/plan-catalogue';

type Db = Tx | typeof db;

export async function loadEffectivePlans(client: Db = db): Promise<Record<Tier, EffectivePlan>> {
  const rows = await client.membershipPlan.findMany();
  const byTier = new Map(rows.map((r) => [r.tier as Tier, r]));
  const out = {} as Record<Tier, EffectivePlan>;
  for (const t of TIERS) {
    const r = byTier.get(t);
    out[t] = mergePlan(t, r ? { tier: t, name: r.name, priceInrMinor: r.priceInrMinor, durationDays: r.durationDays, couponMaxPercent: r.couponMaxPercent, adViewsPerDay: r.adViewsPerDay, benefits: r.benefits, active: r.active } : null);
  }
  return out;
}

export async function effectivePlan(tier: Tier, client: Db = db): Promise<EffectivePlan> {
  return (await loadEffectivePlans(client))[tier];
}

const jsonMeta = (r: PlanRow | PlanUpdate) => ({ ...r, priceInrMinor: r.priceInrMinor.toString() });

/** Admin update. Existing memberships keep their current expiry; new purchases use the new values. */
export async function updatePlan(tier: Tier, update: PlanUpdate, actorId: string) {
  const errors = validatePlanUpdate(update);
  if (errors.length) throw new DomainError('PLAN_INVALID', errors.join('; '), 422);
  return db.$transaction(async (tx) => {
    const before = await tx.membershipPlan.findUnique({ where: { tier } });
    const saved = await tx.membershipPlan.upsert({
      where: { tier },
      create: { tier, ...update, name: update.name.trim(), updatedBy: actorId },
      update: { ...update, name: update.name.trim(), updatedBy: actorId },
    });
    await audit(tx, {
      action: 'plan.updated',
      actorId,
      targetId: tier,
      meta: { before: before ? jsonMeta({ tier, name: before.name, priceInrMinor: before.priceInrMinor, durationDays: before.durationDays, couponMaxPercent: before.couponMaxPercent, adViewsPerDay: before.adViewsPerDay, benefits: before.benefits, active: before.active }) : null, after: jsonMeta({ tier, ...update }) },
    });
    return saved;
  });
}
