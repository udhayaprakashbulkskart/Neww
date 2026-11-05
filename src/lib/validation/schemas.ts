import { z } from 'zod';
/** Platform cap for one campaign request, kept below the 32-bit limit used for money columns. */
export const CAMPAIGN_REQUEST_CAP_PAISE = 990_000_000;

/** Shared, reusable validation. Every API route parses input through these before touching the DB. */

const MOBILE_RE = /^[6-9]\d{9}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const PINCODE_RE = /^[1-9]\d{5}$/;
const NAME_RE = /^[\p{L}][\p{L}\p{M} .'-]{1,79}$/u;

/** Accepts "+91 98765 43210", "09876543210", "9876543210" and returns the 10-digit Indian mobile. */
export const mobileSchema = z
  .string()
  .transform((v) => v.replace(/[\s()-]/g, '').replace(/^\+?91(?=\d{10}$)/, '').replace(/^0(?=\d{10}$)/, ''))
  .refine((v) => MOBILE_RE.test(v), 'Enter a valid 10-digit Indian mobile number.');

export const otpCodeSchema = z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code.');

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, 'Enter your full name.')
  .max(80)
  .regex(NAME_RE, 'Use letters only for your name.');

export const emailSchema = z.string().trim().toLowerCase().email().max(120);

export const userTypeSchema = z.enum(['BENEFICIARY', 'DONOR', 'BOTH']);

export const registerSchema = z.object({
  mobile: mobileSchema,
  fullName: fullNameSchema,
  userType: userTypeSchema,
  email: emailSchema.optional().or(z.literal('').transform(() => undefined)),
  consent: z.literal(true, { errorMap: () => ({ message: 'Please accept the terms and privacy policy.' }) }),
});

export const otpRequestSchema = z.object({
  mobile: mobileSchema,
  purpose: z.enum(['LOGIN', 'REGISTER']),
  // Only used when purpose is REGISTER; stored encrypted until the code is verified.
  fullName: fullNameSchema.optional(),
  userType: userTypeSchema.optional(),
  consent: z.boolean().optional(),
});

export const otpVerifySchema = z.object({
  mobile: mobileSchema,
  purpose: z.enum(['LOGIN', 'REGISTER']),
  code: otpCodeSchema,
});

export const profileUpdateSchema = z.object({
  fullName: fullNameSchema.optional(),
  userType: userTypeSchema.optional(),
  email: emailSchema.optional(),
  addressLine: z.string().trim().min(5).max(200).optional(),
  city: z.string().trim().min(2).max(60).optional(),
  state: z.string().trim().min(2).max(60).optional(),
  pincode: z.string().trim().regex(PINCODE_RE, 'Enter a valid 6-digit pincode.').optional(),
  occupation: z.string().trim().max(80).optional(),
  notifyEmail: z.boolean().optional(),
  notifySms: z.boolean().optional(),
  notifyWhatsapp: z.boolean().optional(),
});

const paiseSchema = z.number().int().nonnegative().max(990_000_000);

export const campaignCreateSchema = z.object({}).strict();

export const campaignPersonalSchema = z.object({
  fullName: fullNameSchema,
  mobile: mobileSchema,
  addressLine: z.string().trim().min(5, 'Enter your address.').max(200),
  city: z.string().trim().min(2, 'Enter your city.').max(60),
  state: z.string().trim().min(2, 'Enter your state.').max(60),
  pincode: z.string().trim().regex(PINCODE_RE, 'Enter a valid 6-digit pincode.'),
});

export const campaignDetailsSchema = z.object({
  title: z.string().trim().min(10, 'Give your campaign a clear title (10+ characters).').max(120),
  categorySlug: z.string().min(2).max(40),
  story: z.string().trim().min(100, 'Describe your situation in at least 100 characters.').max(4000),
  urgency: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  endsInDays: z.number().int().min(7).max(180).default(60),
});

export const campaignFinancialSchema = z
  .object({
    totalDebtPaise: paiseSchema.min(100, 'Enter the total debt.'),
    paidPaise: paiseSchema,
    requestedPaise: paiseSchema.min(10_000, 'Requested amount must be at least Rs 100.'),
  })
  .superRefine((v, ctx) => {
    if (v.paidPaise > v.totalDebtPaise) {
      ctx.addIssue({ code: 'custom', path: ['paidPaise'], message: 'Amount already paid cannot exceed the total debt.' });
    }
    const remaining = v.totalDebtPaise - v.paidPaise;
    if (v.requestedPaise > remaining) {
      ctx.addIssue({
        code: 'custom',
        path: ['requestedPaise'],
        message: 'Requested amount cannot be more than the remaining balance.',
      });
    }
    if (v.requestedPaise > CAMPAIGN_REQUEST_CAP_PAISE) {
      ctx.addIssue({ code: 'custom', path: ['requestedPaise'], message: 'Requested amount is above the platform limit.' });
    }
  });

export const bankAccountSchema = z
  .object({
    accountHolderName: fullNameSchema,
    accountNumber: z.string().trim().regex(/^\d{9,18}$/, 'Enter a valid bank account number.'),
    confirmAccountNumber: z.string().trim(),
    ifscCode: z.string().trim().toUpperCase().regex(IFSC_RE, 'Enter a valid IFSC code.'),
    bankName: z.string().trim().max(80).optional(),
  })
  .refine((v) => v.accountNumber === v.confirmAccountNumber, {
    path: ['confirmAccountNumber'],
    message: 'Account numbers do not match.',
  });

export const donationCreateSchema = z.object({
  campaignId: z.string().min(10).max(40),
  amountPaise: z.number().int().positive(),
  isAnonymous: z.boolean().default(false),
  idempotencyKey: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/),
});

export const donationVerifySchema = z.object({
  donationId: z.string().min(10).max(40),
  razorpay_order_id: z.string().min(5).max(64),
  razorpay_payment_id: z.string().min(5).max(64),
  razorpay_signature: z.string().min(16).max(256),
});

export const refundRequestSchema = z.object({
  reason: z.string().trim().min(10, 'Tell us why you want a refund (10+ characters).').max(500),
});

export const updateSchema = z.object({
  body: z.string().trim().min(10).max(1000),
});

export const complaintSchema = z.object({
  campaignId: z.string().min(10).max(40).optional(),
  subject: z.string().trim().min(5).max(120),
  body: z.string().trim().min(20).max(3000),
});

export const fraudReportSchema = z.object({
  campaignId: z.string().min(10).max(40),
  reason: z.string().trim().min(15).max(1000),
});

export const savedSchema = z.object({ campaignId: z.string().min(10).max(40) });

export const campaignReviewSchema = z.object({
  action: z.enum(['START_REVIEW', 'REQUEST_INFO', 'APPROVE', 'REJECT', 'PUBLISH', 'CLOSE']),
  note: z.string().trim().max(1000).optional(),
});

export const documentReviewSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED', 'ADDITIONAL_REQUIRED']),
  note: z.string().trim().max(500).optional(),
});

export const verificationReviewSchema = z.object({
  decision: z.enum(['VERIFIED', 'REJECTED', 'ADDITIONAL_INFO_REQUIRED']),
  note: z.string().trim().max(500).optional(),
});

export const suspendSchema = z.object({
  suspended: z.boolean(),
  reason: z.string().trim().min(10).max(500),
});

export const complaintUpdateSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
  response: z.string().trim().max(2000).optional(),
});

export const fraudUpdateSchema = z.object({
  status: z.enum(['OPEN', 'UNDER_INVESTIGATION', 'DISMISSED', 'CONFIRMED']),
  resolution: z.string().trim().max(1000).optional(),
});

export const refundDecisionSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  note: z.string().trim().min(3).max(500),
});

export const exportSchema = z.object({
  type: z.enum(['donations', 'campaigns', 'payments', 'refunds', 'audit']),
});

export const campaignSearchSchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().max(40).optional(),
  city: z.string().trim().max(60).optional(),
  funding: z.enum(['all', 'open', 'nearly', 'funded']).default('all'),
  sort: z.enum(['latest', 'urgent', 'supported', 'nearly']).default('latest'),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});

export const notificationPrefsSchema = profileUpdateSchema.pick({
  notifyEmail: true,
  notifySms: true,
  notifyWhatsapp: true,
});

export const settingSchema = z.object({
  key: z.enum(['donation_min_paise', 'donation_max_paise', 'maintenance_mode']),
  value: z.union([z.number(), z.boolean(), z.string()]),
});
