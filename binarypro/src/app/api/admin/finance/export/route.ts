import { requirePermission, handle, fail } from '@/lib/server/http';
import { dateRange } from '@/lib/domain/finance';
import { buildTable, REPORTS, toCsvDocument, toPrintHtml, type ReportName } from '@/lib/server/finance-export';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/finance/export?report=sales&from=YYYY-MM-DD&to=YYYY-MM-DD&format=csv|pdf
// `pdf` returns a print-ready page; the browser's "Save as PDF" produces the file.
export async function GET(req: Request) {
  return handle(async () => {
    await requirePermission('finance:read');
    const url = new URL(req.url);
    const report = url.searchParams.get('report') ?? '';
    const format = url.searchParams.get('format') ?? 'csv';
    const from = url.searchParams.get('from') ?? '';
    const to = url.searchParams.get('to') ?? '';
    if (!(REPORTS as readonly string[]).includes(report)) return fail('BAD_REPORT', 'Unknown report', 400);
    if (format !== 'csv' && format !== 'pdf') return fail('BAD_FORMAT', 'Format must be csv or pdf', 400);
    const range = dateRange(from, to);
    if (!range) return fail('BAD_RANGE', 'Use a valid from and to date (YYYY-MM-DD, to on or after from)', 400);

    const table = await buildTable(report as ReportName, range, from, to);
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
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'",
      },
    });
  });
}
