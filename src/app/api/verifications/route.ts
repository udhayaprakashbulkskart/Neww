import { handle, json } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { maskedBank, verificationSummary } from '@/lib/services/verification';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const user = await requireUser();
  const summary = await verificationSummary(user.id);
  return json({ items: summary.items, banks: summary.banks.map((b) => ({ id: b.id, ...maskedBank(b), status: b.status, isPrimary: b.isPrimary })) });
});
