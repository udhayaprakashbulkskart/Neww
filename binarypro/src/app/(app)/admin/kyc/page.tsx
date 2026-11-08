import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { can, type StaffRole } from '@/lib/domain/rbac';
import { listKycQueue } from '@/lib/server/kyc';
import { KycDecision } from '@/components/admin/kyc-decision';
import { Section, Notice } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function KycPage() {
  const user = await currentUser();
  if (!user) redirect('/login');
  if (!can(user.role as StaffRole, 'kyc:review')) redirect('/dashboard');
  const queue = await listKycQueue();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Identity review</h1>
          <p className="text-sm text-[#a39a86]">Check each sign-up&apos;s documents against the details entered. Approving unlocks withdrawals. Every document view is logged.</p>
        </div>
        <Link href="/admin" className="text-sm underline">Back to admin</Link>
      </div>

      <Section title={`Waiting for review (${queue.length})`} subtitle="Oldest first.">
        {queue.length === 0 ? <Notice>No sign-ups are waiting for review.</Notice> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-[#a39a86]">
                <tr><th className="py-2">Submitted</th><th>Member</th><th>Contact</th><th>Referral</th><th>Bank account</th><th>Documents</th><th>Decision</th></tr>
              </thead>
              <tbody>
                {queue.map((u) => (
                  <tr key={u.id} className="border-t border-[#2a2116] align-top">
                    <td className="py-2 whitespace-nowrap">{u.kycSubmittedAt?.toISOString().slice(0, 10) ?? '-'}</td>
                    <td><div className="font-semibold">{u.name}</div><div className="break-all text-[#8f8672]">{u.email}</div></td>
                    <td>{u.phone}</td>
                    <td>
                      <div className="font-mono">{u.referralCode}</div>
                      <div className="text-[#8f8672]">Invited by {u.sponsor ? `${u.sponsor.name} (${u.sponsor.referralCode})` : 'no sponsor'}</div>
                    </td>
                    <td>
                      {u.bankAccount ? (
                        <>
                          <div>{u.bankAccount.accountHolder}</div>
                          <div className="text-[#8f8672]">{u.bankAccount.bankName} · {u.bankAccount.ifsc}</div>
                          <div className="font-mono text-[#8f8672]">A/c ending {u.bankAccount.accountLast4}</div>
                        </>
                      ) : <span className="text-orange-300">Missing</span>}
                    </td>
                    <td>
                      <ul className="space-y-1">
                        {u.kycDocuments.map((d) => (
                          <li key={d.id}>
                            <a className="underline" target="_blank" rel="noopener" href={`/api/admin/kyc/documents/${d.id}`}>
                              {d.kind === 'AADHAAR' ? 'Aadhaar' : 'PAN'}
                            </a>{' '}
                            <span className="text-[#8f8672]">({Math.round(d.sizeBytes / 1024)} KB)</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td><KycDecision userId={u.id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
