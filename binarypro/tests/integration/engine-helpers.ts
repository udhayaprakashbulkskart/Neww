import { runReconciliation } from '@/lib/server/reconciliation';

export async function reconcileAndStore(actorId: string, reason: string) {
  return runReconciliation(actorId, reason);
}
