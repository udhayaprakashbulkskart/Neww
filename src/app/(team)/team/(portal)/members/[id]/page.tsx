import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireTeamPage } from '@/lib/team/session';
import { getMemberProfile } from '@/lib/team/members';
import { ApiError } from '@/lib/http';
import { KYC_LABEL_TEXT, ROLE_TEXT } from '@/lib/team/labels';
import { Avatar, btnGhost, card, formatBytes, KycBadge, Notice, btnPrimary } from '@/components/team/ui';
import { StartChatButton } from '@/components/team/start-chat-button';

export const metadata: Metadata = { title: { absolute: 'Member profile · Team Portal' }, robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function MemberProfilePage({ params }: { params: { id: string } }) {
  const actor = await requireTeamPage();
  let profile;
  try {
    profile = await getMemberProfile(actor, params.id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const { member, documents, canSeeKyc, kycUpdatedAt, joinedAt } = profile;
  const isMe = member.id === actor.id;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/team" className="inline-flex items-center gap-2 text-sm font-semibold text-tp-muted hover:text-tp-purple">
        ← Back to directory
      </Link>

      <section className={`${card} overflow-hidden`}>
        <div className="h-28 bg-gradient-to-r from-tp-navy via-tp-purpleDark to-tp-purple md:h-36" />
        <div className="-mt-16 flex flex-col gap-6 px-6 pb-7 md:-mt-20 md:flex-row md:items-end md:px-10">
          <Avatar name={member.fullName} initials={member.initials} photoUrl={member.photoUrl} size="xl" seed={member.id} className="ring-4 ring-white shadow-[0_18px_40px_-16px_rgba(40,30,110,0.5)]" />
          <div className="min-w-0 flex-1 pb-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{member.fullName}</h1>
              <KycBadge status={member.kycStatus} />
              {!member.active && <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">Deactivated</span>}
            </div>
            <p className="mt-1 text-sm text-tp-muted">
              {member.jobTitle ?? 'Team member'} · {ROLE_TEXT[member.role]}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {!isMe && <StartChatButton memberId={member.id} className={btnPrimary} label="Chat" />}
            {isMe && (
              <Link href="/team/profile" className={btnGhost}>
                Edit my profile
              </Link>
            )}
            {actor.isAdmin && (
              <Link href={`/team/admin/members/${member.id}`} className={btnGhost}>
                Manage member
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section className={`${card} p-6`}>
          <h2 className="mb-5 text-sm font-bold uppercase tracking-wider text-tp-muted">Contact</h2>
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-tp-muted">Phone number</dt>
              <dd className="mt-0.5 text-base font-semibold">
                <a href={`tel:${member.phone}`} className="text-tp-purple hover:underline">
                  {member.phone}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-tp-muted">Role</dt>
              <dd className="mt-0.5 font-semibold">{ROLE_TEXT[member.role]}</dd>
            </div>
            {member.bio && (
              <div>
                <dt className="text-tp-muted">About</dt>
                <dd className="mt-0.5 whitespace-pre-wrap leading-relaxed">{member.bio}</dd>
              </div>
            )}
            {joinedAt && (
              <div>
                <dt className="text-tp-muted">Joined</dt>
                <dd className="mt-0.5 font-semibold">{new Date(joinedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</dd>
              </div>
            )}
          </dl>
        </section>

        <section className={`${card} p-6`}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-tp-muted">KYC documents</h2>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-tp-muted">Document verification</span>
              <KycBadge status={member.kycStatus} />
            </div>
          </div>
          {kycUpdatedAt && (
            <p className="-mt-2 mb-4 text-xs text-tp-muted">Status updated {new Date(kycUpdatedAt).toLocaleDateString('en-IN')}</p>
          )}

          {!canSeeKyc && (
            <Notice tone="info">KYC documents are private. Only the member and administrators can view them.</Notice>
          )}

          {canSeeKyc && documents && documents.length === 0 && (
            <p className="rounded-xl border border-dashed border-tp-line p-6 text-center text-sm text-tp-muted">No KYC documents uploaded yet.</p>
          )}

          {canSeeKyc && documents && documents.length > 0 && (
            <ul className="space-y-3">
              {documents.map((d) => (
                <li key={d.id} className="flex items-center gap-3 rounded-xl border border-tp-line bg-tp-canvas px-4 py-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-tp-lilac text-xs font-bold text-tp-purple">
                    {d.mimeType === 'application/pdf' ? 'PDF' : 'IMG'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{d.label ? KYC_LABEL_TEXT[d.label] ?? 'Document' : 'Document'}</p>
                    <p className="text-xs text-tp-muted">
                      {formatBytes(d.sizeBytes)} · Uploaded {new Date(d.createdAt).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <a href={d.url} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-tp-purple hover:bg-tp-lilac">
                    Open
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
