import { requirePermission, handle, fail } from '@/lib/server/http';
import { dateRange } from '@/lib/domain/finance';
import { resolveUserId } from '@/lib/server/audit-view';
import { buildTable, REPORTS, toCsvDocument, toPrintHtml, type ReportName } from '@/lib/server/finance-export';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/finance/export?report=…&from=YYYY-MM-DD&to=YYYY-MM-DD&format=csv|pdf
// Optional filters: user (id or email), txId, reference, type, action, actor (id or email), target.
// `pdf` returns a print-ready page; the browser's "Save as PDF" produces the file.
export async function GET(req: Request) {
  return handle(async () => {
    const url = new URL(req.url);
    const report = url.searchParams.get('report') ?? '';
    const format = url.searchParams.get('format') ?? 'csv';
    const from = url.searchParams.get('from') ?? '';
    const to = url.searchParams.get('to') ?? '';
    if (!(REPORTS as readonly string[]).includes(report)) return fail('BAD_REPORT', 'Unknown report', 400);
    if (format !== 'csv' && format !== 'pdf') return fail('BAD_FORMAT', 'Format must be csv or pdf', 400);
    const range = dateRange(from, to);
    if (!range) return fail('BAD_RANGE', 'Use a valid from and to date (YYYY-MM-DD, to on or after from)', 400);

    // The audit log needs audit:read; every other report needs finance:read.
    await requirePermission(report === 'audit' ? 'audit:read' : 'finance:read');

    const param = (k: string) => url.searchParams.get(k)?.trim() || undefined;
    const userParam = param('user');
    const actorParam = param('actor');
    const userId = userParam ? await resolveUserId(userParam) : null;
    const actorId = actorParam ? await resolveUserId(actorParam) : null;
    if ((userParam && !userId) || (actorParam && !actorId)) {
      return fail('UNKNOWN_USER', 'No member matches that id or email', 404);
    }

    const table = await buildTable(report as ReportName, range, from, to, undefined, {
      audit: { action: param('action'), actorId: actorId ?? undefined, targetId: param('target') },
      ledger: { userId: userId ?? undefined, txId: param('txId'), reference: param('reference'), type: param('type') },
    });
    const stamp = `${report}-${from}-to-${to}`;
    if (format === 'csv') {
      return new Response(toCsvDocument(table), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${stamp}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }
    return new Response(toPrintHtml(table, new Date()), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${stamp}.html"`,
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
      },
    });
  });
}
