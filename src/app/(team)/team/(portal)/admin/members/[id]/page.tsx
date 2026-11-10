import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/team/session';
import { getMemberProfile, listKycDocuments } from '@/lib/team/members';
import { isGroupMember } from '@/lib/team/chat';
import { ApiError } from '@/lib/http';
import { AdminMemberEditor } from '@/components/team/admin-member-editor';

export const metadata: Metadata = { title: { absolute: 'Manage member · Team Portal' }, robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function AdminMemberPage({ params }: { params: { id: string } }) {
  const actor = await requireAdminPage();
  let profile;
  try {
    profile = await getMemberProfile(actor, params.id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const [documents, inGroup] = await Promise.all([listKycDocuments(actor, params.id), isGroupMember(params.id)]);
  const m = profile.member;
  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{m.fullName}</h1>
        <p className="mt-1 text-sm text-tp-muted">Manage profile, photo, KYC documents, access and group membership.</p>
      </header>
      <AdminMemberEditor
        member={{
          id: m.id,
          fullName: m.fullName,
          phone: m.phone,
          jobTitle: m.jobTitle,
          bio: m.bio,
          role: m.role,
          active: m.active,
          kycStatus: m.kycStatus,
          photoUrl: m.photoUrl,
          initials: m.initials,
        }}
        documents={documents.map((d) => ({ id: d.id, label: d.label, mimeType: d.mimeType, sizeBytes: d.sizeBytes, createdAt: d.createdAt, url: d.url }))}
        inGroup={inGroup}
        isSelf={m.id === actor.id}
      />
    </div>
  );
}
