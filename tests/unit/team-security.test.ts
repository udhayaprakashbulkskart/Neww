import { describe, expect, it } from 'vitest';
import { hashPassword, namesMatch, normalizePhone, safeFileName, sniffTeamFile, verifyPassword } from '@/lib/team/security';

describe('team phone normalisation', () => {
  it('treats a bare 10-digit number as an Indian mobile', () => {
    expect(normalizePhone('98765 43210')).toBe('+919876543210');
  });
  it('keeps an explicit country code', () => {
    expect(normalizePhone('+1 (415) 555-0100')).toBe('+14155550100');
  });
  it('rejects numbers that are too short or too long', () => {
    expect(() => normalizePhone('12345')).toThrow();
    expect(() => normalizePhone('+1234567890123456')).toThrow();
  });
});

describe('team password hashing', () => {
  it('verifies the right password and rejects the wrong one', async () => {
    const stored = await hashPassword('correct-horse-battery');
    expect(stored.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('correct-horse-battery', stored)).toBe(true);
    expect(await verifyPassword('correct-horse-batterx', stored)).toBe(false);
  });
  it('salts every hash', async () => {
    const a = await hashPassword('same-password-here');
    const b = await hashPassword('same-password-here');
    expect(a).not.toBe(b);
  });
  it('rejects malformed stored values', async () => {
    expect(await verifyPassword('anything-at-all', 'not-a-hash')).toBe(false);
  });
});

describe('team file sniffing', () => {
  it('identifies PDF, JPEG, PNG and WebP by magic bytes', () => {
    expect(sniffTeamFile(Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(8)]))).toBe('pdf');
    expect(sniffTeamFile(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(12)]))).toBe('jpeg');
    expect(sniffTeamFile(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(8)]))).toBe('png');
    expect(sniffTeamFile(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]))).toBe('webp');
  });
  it('refuses executables and text renamed to documents', () => {
    expect(sniffTeamFile(Buffer.from('MZ\x90\x00 this is a windows executable'))).toBeNull();
    expect(sniffTeamFile(Buffer.from('<html><script>alert(1)</script></html>'))).toBeNull();
  });
});

describe('team file names', () => {
  it('strips paths and unsafe characters', () => {
    expect(safeFileName('../../etc/passwd')).toBe('passwd');
    expect(safeFileName('C:\\Users\\me\\Aadhaar "scan".pdf')).toBe('Aadhaar _scan_.pdf');
    expect(safeFileName('   ')).toBe('file');
  });
});

describe('team sign-in name matching', () => {
  it('ignores case, extra spaces and punctuation', () => {
    expect(namesMatch('  asha   RAO ', 'Asha Rao')).toBe(true);
    expect(namesMatch("Priya O'Brien", 'Priya OBrien')).toBe(true);
  });
  it('rejects a different name and an empty name', () => {
    expect(namesMatch('Asha Rai', 'Asha Rao')).toBe(false);
    expect(namesMatch('   ', '   ')).toBe(false);
  });
});
