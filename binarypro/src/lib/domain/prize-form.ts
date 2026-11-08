// Validation for prize records written by admins. Shared by the API routes.
import { z } from 'zod';

export const PrizeBody = z.object({
  name: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(120),
  imageUrl: z
    .string()
    .trim()
    .max(300)
    .refine((v) => v.startsWith('/prizes/') || v.startsWith('https://'), 'Image must be under /prizes/ or an https URL'),
  description: z.string().trim().min(1).max(500),
  details: z.array(z.string().trim().min(1).max(140)).max(8),
  supplierNote: z.string().trim().max(300),
  sortOrder: z.number().int().min(0).max(999),
  active: z.boolean(),
});
export type PrizeBodyInput = z.infer<typeof PrizeBody>;
