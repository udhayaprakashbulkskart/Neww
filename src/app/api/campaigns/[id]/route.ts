import { handle, json } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { getOwnedCampaign } from '@/lib/services/campaigns';

export const dynamic = 'force-dynamic';

/** Owner view only. Public detail is served by /api/public/campaigns/[slug]. */
export const GET = handle<{ params: { id: string } }>(async (_req, { params }) => {
  const user = await requireUser();
  const c = await getOwnedCampaign(user.id, params.id);
  return json({
    id: c.id,
    slug: c.slug,
    title: c.title,
    story: c.story,
    status: c.status,
    urgency: c.urgency,
    city: c.city,
    state: c.state,
    category: { slug: c.category.slug, name: c.category.name },
    totalDebtPaise: c.totalDebtPaise,
    paidPaise: c.paidPaise,
    remainingPaise: c.remainingPaise,
    requestedPaise: c.requestedPaise,
    raisedPaise: c.raisedPaise,
    fundingPercent: c.fundingPercent,
    donorCount: c.donorCount,
    endsAt: c.endsAt,
    submittedAt: c.submittedAt,
    reviewNote: c.reviewNote,
    rejectionReason: c.rejectionReason,
    documents: c.documents,
    updates: c.updates,
    beneficiary: {
      fullName: c.beneficiary.fullName,
      mobileLast4: c.beneficiary.mobileLast4,
      profile: c.beneficiary.profile,
    },
  });
});
