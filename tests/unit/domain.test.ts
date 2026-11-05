import { describe, expect, it } from 'vitest';
import { assertTransition, canTransition, CAMPAIGN_TRANSITIONS, EDITABLE_STATUSES } from '@/lib/state/campaign-machine';
import { sniffFileType, allowedTypesFor, sanitiseFileName } from '@/lib/services/documents';
import { normaliseTitle, csvSafe } from '@/lib/services/text';
import { maskedName } from '@/lib/mask';
import { formatINR, formatINRCompact, percent, publicName, initials, slugify, daysLeft } from '@/lib/format';
import { rupeesToPaise } from '@/lib/client/api';
import { buildHref } from '@/components/browse/campaign-browser';
import { rateLimit, resetRateLimits } from '@/lib/rate-limit';
import { escapeHtml } from '@/lib/html';
import { ApiError } from '@/lib/http';

describe('campaign lifecycle', () => {
  it('allows the review path from submission to publication', () => {
    const path = ['DRAFT', 'PENDING', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED'] as const;
    for (let i = 0; i < path.length - 1; i++) expect(canTransition(path[i], path[i + 1])).toBe(true);
  });

  it('never allows publishing without approval', () => {
    expect(canTransition('UNDER_REVIEW', 'PUBLISHED')).toBe(false);
    expect(canTransition('PENDING', 'PUBLISHED')).toBe(false);
    expect(canTransition('DRAFT', 'PUBLISHED')).toBe(false);
    expect(canTransition('REJECTED', 'PUBLISHED')).toBe(false);
  });

  it('keeps closed campaigns terminal', () => {
    expect(CAMPAIGN_TRANSITIONS.CLOSED).toEqual([]);
    expect(() => assertTransition('CLOSED', 'PUBLISHED')).toThrow(ApiError);
  });

  it('lets a rejected campaign return to draft for correction', () => {
    expect(canTransition('REJECTED', 'DRAFT')).toBe(true);
  });

  it('only lets the beneficiary edit drafts, requested changes and rejected campaigns', () => {
    expect(EDITABLE_STATUSES).toEqual(['DRAFT', 'ADDITIONAL_INFO_REQUIRED', 'REJECTED']);
  });
});

describe('document validation', () => {
  const pdf = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(16)]);
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
  const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]);
  const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypmp42'), Buffer.alloc(8)]);

  it('identifies files by content, not by name', () => {
    expect(sniffFileType(pdf)).toBe('pdf');
    expect(sniffFileType(png)).toBe('png');
    expect(sniffFileType(jpg)).toBe('jpeg');
    expect(sniffFileType(mp4)).toBe('mp4');
  });

  it('rejects executables and scripts disguised as documents', () => {
    expect(sniffFileType(Buffer.from('MZ\x90\x00 this is a windows executable padding'))).toBeNull();
    expect(sniffFileType(Buffer.from('<script>alert(1)</script> padding padding'))).toBeNull();
    expect(sniffFileType(Buffer.from('short'))).toBeNull();
  });

  it('limits photos to images and videos to MP4 with a smaller ceiling', () => {
    expect(allowedTypesFor('PHOTO').types).not.toContain('pdf');
    expect(allowedTypesFor('VIDEO').types).toEqual(['mp4']);
    expect(allowedTypesFor('VIDEO').maxBytes).toBe(25 * 1024 * 1024);
  });

  it('strips path components and unsafe characters from file names', () => {
    expect(sanitiseFileName('../../etc/passwd')).toBe('passwd');
    expect(sanitiseFileName('bill<script>.pdf')).toBe('bill_script_.pdf');
    expect(sanitiseFileName('')).toBe('document');
  });
});

describe('text safety', () => {
  it('neutralises CSV formula injection', () => {
    expect(csvSafe('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvSafe('+1+1')).toBe(`"'+1+1"`);
    expect(csvSafe('plain')).toBe('"plain"');
  });

  it('escapes HTML in receipts', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  });

  it('normalises titles for duplicate detection', () => {
    expect(normaliseTitle('  Help   me, please!! ')).toBe(normaliseTitle('help me please'));
  });

  it('masks names for staff lists', () => {
    expect(maskedName('Murugan Ramasamy')).toBe('M***** R*****');
    expect(maskedName('A')).toBe('A');
  });
});

describe('money and display formatting', () => {
  it('formats paise as Indian-grouped rupees', () => {
    expect(formatINR(10_500_000)).toBe('₹1,05,000');
    expect(formatINR(10_550_050, { decimals: true })).toBe('₹1,05,500.50');
  });

  it('compacts large amounts', () => {
    expect(formatINRCompact(10_500_000)).toBe('₹1.1L'.replace('1.1', '1.1'));
    expect(formatINRCompact(1_200_000_000)).toBe('₹1.2 Cr');
  });

  it('converts rupee input to integer paise without float drift', () => {
    expect(rupeesToPaise('1,05,000')).toBe(10_500_000);
    expect(rupeesToPaise('₹0.1')).toBe(10);
    expect(rupeesToPaise('abc')).toBeNaN();
    expect(rupeesToPaise('-5')).toBeNaN();
  });

  it('caps funding at 100 percent', () => {
    expect(percent(150, 100)).toBe(100);
    expect(percent(0, 0)).toBe(0);
    expect(percent(70, 100)).toBe(70);
  });

  it('shows the beneficiary by first name and last initial only', () => {
    expect(publicName('Murugan Ramasamy')).toBe('Murugan R.');
    expect(publicName('Priya')).toBe('Priya');
    expect(initials('Lakshmi Devi Selvam')).toBe('LS');
  });

  it('builds URL-safe slugs', () => {
    expect(slugify("Support my mother's treatment!")).toBe('support-my-mothers-treatment');
  });

  it('counts remaining days and never goes negative', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    expect(daysLeft(new Date('2026-01-11T00:00:00Z'), now)).toBe(10);
    expect(daysLeft(new Date('2025-12-01T00:00:00Z'), now)).toBe(0);
    expect(daysLeft(null, now)).toBeNull();
  });
});

describe('browse links', () => {
  it('keeps existing filters and resets pagination when a filter changes', () => {
    const href = buildHref('/app/explore', { q: 'school', sort: 'urgent', page: '3' }, { category: 'education' });
    const url = new URL(href, 'http://x');
    expect(url.searchParams.get('q')).toBe('school');
    expect(url.searchParams.get('category')).toBe('education');
    expect(url.searchParams.has('page')).toBe(false);
  });

  it('drops "all" filter values from URLs', () => {
    expect(buildHref('/explore', { funding: 'nearly' }, { funding: 'all' })).toBe('/explore');
  });
});

describe('rate limiting', () => {
  it('allows requests within the limit and blocks the next one', () => {
    resetRateLimits();
    for (let i = 0; i < 3; i++) rateLimit('k', 3, 60_000);
    expect(() => rateLimit('k', 3, 60_000)).toThrow();
  });

  it('keeps separate buckets per key', () => {
    resetRateLimits();
    for (let i = 0; i < 3; i++) rateLimit('a', 3, 60_000);
    expect(() => rateLimit('b', 3, 60_000)).not.toThrow();
  });
});
