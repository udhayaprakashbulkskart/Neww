import { z } from 'zod';

export const TEAM_MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // stays under the 4.5 MB serverless request body limit
export const TEAM_MESSAGE_MAX = 4000;

export const loginSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(6).max(24),
  password: z.string().min(1).max(256),
});

export const createMemberSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(6).max(24),
  password: z.string().min(10).max(128),
  jobTitle: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(1000).optional(),
  role: z.enum(['ADMIN', 'MEMBER']).optional(),
});

export const updateMemberSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().min(6).max(24).optional(),
  jobTitle: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(1000).optional(),
  active: z.boolean().optional(),
  kycStatus: z.enum(['PENDING', 'VERIFIED', 'REJECTED']).optional(),
  role: z.enum(['ADMIN', 'MEMBER']).optional(),
  password: z.string().min(10).max(128).optional(),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(10).max(128),
});

export const messageSchema = z.object({
  body: z.string().trim().min(1).max(TEAM_MESSAGE_MAX),
});

export const createConversationSchema = z.object({
  memberId: z.string().min(1).max(64),
});

export const groupMembershipSchema = z.object({
  memberId: z.string().min(1).max(64),
  member: z.boolean(),
});

export const kycLabels = ['AADHAAR', 'PAN', 'PASSPORT', 'DRIVING_LICENCE', 'VOTER_ID', 'ADDRESS_PROOF', 'OTHER'] as const;
export const kycLabelSchema = z.enum(kycLabels);
