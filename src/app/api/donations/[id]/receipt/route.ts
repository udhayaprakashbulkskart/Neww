import { handle } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { receiptData } from '@/lib/services/donations';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';
import { formatDate, formatINR } from '@/lib/format';
import { escapeHtml } from '@/lib/html';

export const dynamic = 'force-dynamic';

/**
 * Digital receipt as a print-ready HTML page (use the browser's Save as PDF). The receipt states the
 * donation facts only. It does NOT claim any tax deduction for the donor.
 */
export const GET = handle<{ params: { id: string } }>(async (_req, { params }) => {
  const user = await requireUser();
  const isStaff = await hasPermission(user.id, PERMISSIONS.DONATION_VIEW);
  const d = await receiptData(user.id, params.id, isStaff);
  const donor = d.isAnonymous ? 'Anonymous donor' : d.donor.fullName;
  const html = `<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><title>Receipt ${escapeHtml(d.receiptNumber ?? '')}</title>
<meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{font-family:system-ui,sans-serif;color:#111;margin:40px;max-width:640px}
h1{font-size:20px;margin:0 0 4px}.muted{color:#555;font-size:13px}
table{width:100%;border-collapse:collapse;margin-top:24px}td{padding:10px 0;border-bottom:1px solid #eee;font-size:14px}
td:last-child{text-align:right}.total{font-weight:700;font-size:16px}
.note{margin-top:28px;font-size:12px;color:#555;line-height:1.5}
</style></head><body>
<h1>HelpTrust donation receipt</h1><div class="muted">Real People. Real Problems. Verified Help.</div>
<table>
<tr><td>Receipt number</td><td>${escapeHtml(d.receiptNumber ?? '')}</td></tr>
<tr><td>Date</td><td>${escapeHtml(formatDate(d.paidAt))}</td></tr>
<tr><td>Donor</td><td>${escapeHtml(donor)}</td></tr>
<tr><td>Campaign</td><td>${escapeHtml(d.campaign.title)}</td></tr>
<tr><td>Payment reference</td><td>${escapeHtml(d.payment?.providerPaymentId ?? '—')}</td></tr>
<tr><td>Payment method</td><td>${escapeHtml(d.payment?.method ?? '—')}</td></tr>
<tr class="total"><td>Amount received</td><td>${escapeHtml(formatINR(d.amountPaise, { decimals: true }))}</td></tr>
</table>
<p class="note">This receipt confirms the payment received through HelpTrust. HelpTrust does not claim any tax deduction for donors.
Donations are subject to the platform's refund policy. Payments are processed by an authorised payment aggregator.</p>
</body></html>`;
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
      'X-Content-Type-Options': 'nosniff',
    },
  });
});
