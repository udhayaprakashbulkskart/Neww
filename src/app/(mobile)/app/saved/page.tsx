import { requirePageUser } from '@/lib/auth/session';
import { listSaved } from '@/lib/services/campaigns';
import { CampaignRow } from '@/components/mobile/campaign-card';
import { EmptyState } from '@/components/ui/primitives';
import { TopBar } from '@/components/mobile/shell';

export const metadata = { title: 'Saved campaigns' };

export default async function SavedPage() {
  const user = await requirePageUser('/app/saved');
  const items = await listSaved(user.id);
  return (
    <main className="pb-36">
      <TopBar title="Saved campaigns" subtitle={`${items.length} saved`} />
      <div className="px-5">
        {items.length === 0 ? (
          <EmptyState icon="bookmark" title="Nothing saved yet" body="Tap Save on a campaign to keep it here and come back later." action={{ href: '/app/explore', label: 'Explore campaigns' }} />
        ) : (
          <ul className="space-y-3">
            {items.map((c) => (
              <li key={c.id}>
                <CampaignRow c={c} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
