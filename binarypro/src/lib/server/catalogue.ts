// Service catalogue. Products stay in the existing merchant product catalogue.
// Every change records who made it and why, and never edits a price that a sale already used.
import { db } from './db';
import { audit } from './audit';
import { DomainError } from './errors';
import { parseMinor } from '@/lib/domain/money';
import { CURRENCIES, type Currency } from '@/lib/domain/money';

export interface ServiceInput {
  name: string;
  description: string;
  priceRupees: string;
  currency: Currency;
  reason: string;
}

function checkService(input: ServiceInput): bigint {
  if (input.name.trim().length < 2) throw new DomainError('VALIDATION', 'Enter a service name', 422);
  if (input.description.trim().length < 2) throw new DomainError('VALIDATION', 'Enter a description', 422);
  if (!(CURRENCIES as readonly string[]).includes(input.currency)) throw new DomainError('VALIDATION', 'Unsupported currency', 422);
  if (input.reason.trim().length < 8) throw new DomainError('VALIDATION', 'Enter the reason for this change (at least 8 characters)', 422);
  try {
    const v = parseMinor(input.priceRupees);
    if (v <= 0n) throw new Error('nonpositive');
    return v;
  } catch {
    throw new DomainError('VALIDATION', 'Enter a price greater than zero, for example 499 or 499.50', 422);
  }
}

export async function createService(input: ServiceInput, actorId: string) {
  const priceMinor = checkService(input);
  return db.$transaction(async (tx) => {
    const s = await tx.service.create({
      data: { name: input.name.trim(), description: input.description.trim(), priceMinor, currency: input.currency, active: true, updatedAt: new Date() },
    });
    await audit(tx, { action: 'service.created', actorId, targetId: s.id, meta: { reason: input.reason.trim(), price: priceMinor.toString(), currency: input.currency } });
    return s;
  });
}

export async function updateService(id: string, input: ServiceInput & { active: boolean }, actorId: string) {
  const priceMinor = checkService(input);
  return db.$transaction(async (tx) => {
    const before = await tx.service.findUnique({ where: { id } });
    if (!before) throw new DomainError('NOT_FOUND', 'Service not found', 404);
    const after = await tx.service.update({
      where: { id },
      data: { name: input.name.trim(), description: input.description.trim(), priceMinor, currency: input.currency, active: input.active, updatedAt: new Date() },
    });
    await audit(tx, {
      action: 'service.updated',
      actorId,
      targetId: id,
      meta: {
        reason: input.reason.trim(),
        before: { price: before.priceMinor.toString(), active: before.active, currency: before.currency },
        after: { price: after.priceMinor.toString(), active: after.active, currency: after.currency },
      },
    });
    return after;
  });
}

export async function listServices() {
  return db.service.findMany({ orderBy: [{ active: 'desc' }, { name: 'asc' }], take: 500 });
}
