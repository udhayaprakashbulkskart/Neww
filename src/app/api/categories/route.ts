import { handle, json } from '@/lib/http';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const categories = await db.campaignCategory.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, slug: true, name: true, icon: true, tone: true },
  });
  return json({ categories });
});
