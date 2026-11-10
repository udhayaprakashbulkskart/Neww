import type { KycStatus, TeamRole } from '@prisma/client';

/** Human labels for KYC document types. Safe to import from client and server code. */
export const KYC_LABEL_TEXT: Record<string, string> = {
  AADHAAR: 'Aadhaar card',
  PAN: 'PAN card',
  PASSPORT: 'Passport',
  DRIVING_LICENCE: 'Driving licence',
  VOTER_ID: 'Voter ID',
  ADDRESS_PROOF: 'Address proof',
  OTHER: 'Other document',
};

export const KYC_STATUS_TEXT: Record<KycStatus, string> = {
  VERIFIED: 'Verified',
  PENDING: 'Pending',
  REJECTED: 'Rejected',
};

export const ROLE_TEXT: Record<TeamRole, string> = {
  ADMIN: 'Administrator',
  MEMBER: 'Team member',
};
