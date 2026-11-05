import { describe, expect, it } from 'vitest';
import { bankAccountSchema, campaignDetailsSchema, campaignFinancialSchema, campaignSearchSchema, donationCreateSchema, mobileSchema, loginSchema, registerSchema } from '@/lib/validation/schemas';

describe('mobile number normalisation', () => {
  it.each([
    ['9876543210', '9876543210'],
    ['+91 98765 43210', '9876543210'],
    ['09876543210', '9876543210'],
    ['+91-9876543210', '9876543210'],
  ])('accepts %s', (input, expected) => {
    expect(mobileSchema.parse(input)).toBe(expected);
  });

  it.each(['1234567890', '98765', 'abcdefghij', '+1 5551234567'])('rejects %s', (input) => {
    expect(() => mobileSchema.parse(input)).toThrow();
  });
});

describe('registration and sign-in', () => {
  const base = { mobile: '9876543210', fullName: 'Asha Devi', password: 'Sunshine42', consent: true };

  it('requires consent to register', () => {
    expect(() => registerSchema.parse({ ...base, consent: false })).toThrow();
    expect(registerSchema.parse(base).mobile).toBe('9876543210');
  });

  it('rejects names with digits or symbols', () => {
    expect(() => registerSchema.parse({ ...base, fullName: 'Asha 2' })).toThrow();
  });

  it('requires a strong password: 8+ characters with a letter and a number', () => {
    expect(() => registerSchema.parse({ ...base, password: 'short1' })).toThrow(/8 characters/);
    expect(() => registerSchema.parse({ ...base, password: 'allletters' })).toThrow(/number/);
    expect(() => registerSchema.parse({ ...base, password: '12345678' })).toThrow(/letter/);
    expect(registerSchema.parse(base).password).toBe('Sunshine42');
  });

  it('accepts any non-empty password at sign-in (policy is enforced at registration)', () => {
    expect(loginSchema.parse({ mobile: '9876543210', password: 'x' }).password).toBe('x');
    expect(() => loginSchema.parse({ mobile: '9876543210', password: '' })).toThrow();
  });
});

describe('campaign money rules', () => {
  it('rejects paid amounts above the total debt', () => {
    expect(() => campaignFinancialSchema.parse({ totalDebtPaise: 100_000, paidPaise: 200_000, requestedPaise: 10_000 })).toThrow(/cannot exceed/);
  });

  it('rejects a request above the remaining balance', () => {
    expect(() => campaignFinancialSchema.parse({ totalDebtPaise: 1_000_000, paidPaise: 400_000, requestedPaise: 700_000 })).toThrow(/remaining balance/);
  });

  it('accepts a request equal to the remaining balance', () => {
    expect(campaignFinancialSchema.parse({ totalDebtPaise: 1_000_000, paidPaise: 400_000, requestedPaise: 600_000 }).requestedPaise).toBe(600_000);
  });

  it('requires a minimum request of Rs 100', () => {
    expect(() => campaignFinancialSchema.parse({ totalDebtPaise: 5_000, paidPaise: 0, requestedPaise: 5_000 })).toThrow();
  });

  it('requires a substantive campaign story', () => {
    expect(() => campaignDetailsSchema.parse({ title: 'Help my family', categorySlug: 'medical', story: 'Too short.' })).toThrow();
  });
});

describe('donations', () => {
  const base = { campaignId: 'clcampaign000000000000001', amountPaise: 50_000, idempotencyKey: 'don_abcdefgh' };

  it('accepts a valid donation request and defaults to a public name', () => {
    const parsed = donationCreateSchema.parse(base);
    expect(parsed.isAnonymous).toBe(false);
  });

  it('rejects zero, negative and fractional amounts', () => {
    expect(() => donationCreateSchema.parse({ ...base, amountPaise: 0 })).toThrow();
    expect(() => donationCreateSchema.parse({ ...base, amountPaise: -100 })).toThrow();
    expect(() => donationCreateSchema.parse({ ...base, amountPaise: 99.5 })).toThrow();
  });

  it('rejects unsafe idempotency keys', () => {
    expect(() => donationCreateSchema.parse({ ...base, idempotencyKey: "x'; DROP TABLE users;--" })).toThrow();
  });
});

describe('bank details', () => {
  const valid = {
    accountHolderName: 'Murugan Ramasamy',
    accountNumber: '123456789012',
    confirmAccountNumber: '123456789012',
    ifscCode: 'HDFC0001234',
  };

  it('accepts a valid IFSC and matching account numbers', () => {
    expect(bankAccountSchema.parse(valid).ifscCode).toBe('HDFC0001234');
  });

  it('rejects mismatched account numbers', () => {
    expect(() => bankAccountSchema.parse({ ...valid, confirmAccountNumber: '123456789013' })).toThrow(/do not match/);
  });

  it('rejects malformed IFSC codes', () => {
    expect(() => bankAccountSchema.parse({ ...valid, ifscCode: 'HDFC1001234' })).toThrow();
  });
});

describe('campaign search filters', () => {
  it('applies safe defaults', () => {
    const q = campaignSearchSchema.parse({});
    expect(q).toMatchObject({ funding: 'all', sort: 'latest', page: 1, pageSize: 12 });
  });

  it('rejects unknown sort values', () => {
    expect(() => campaignSearchSchema.parse({ sort: 'random; drop' })).toThrow();
  });

  it('caps page size', () => {
    expect(() => campaignSearchSchema.parse({ pageSize: '500' })).toThrow();
  });
});
