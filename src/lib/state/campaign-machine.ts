import type { CampaignStatus } from '@prisma/client';
import { errors } from '../http';

/**
 * Campaign lifecycle. Every status change goes through `assertTransition`, so an invalid jump
 * (for example PUBLISHING an unapproved campaign) is impossible regardless of which route calls it.
 */
export const CAMPAIGN_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  DRAFT: ['PENDING'],
  PENDING: ['UNDER_REVIEW', 'DRAFT'],
  UNDER_REVIEW: ['ADDITIONAL_INFO_REQUIRED', 'APPROVED', 'REJECTED'],
  ADDITIONAL_INFO_REQUIRED: ['PENDING', 'DRAFT', 'REJECTED'],
  APPROVED: ['PUBLISHED', 'REJECTED', 'CLOSED'],
  PUBLISHED: ['CLOSED'],
  REJECTED: ['DRAFT'],
  CLOSED: [],
};

export function canTransition(from: CampaignStatus, to: CampaignStatus): boolean {
  return CAMPAIGN_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: CampaignStatus, to: CampaignStatus): void {
  if (!canTransition(from, to)) {
    throw errors.invalidState(`A campaign cannot move from ${from.replace(/_/g, ' ').toLowerCase()} to ${to.replace(/_/g, ' ').toLowerCase()}.`);
  }
}

/** Statuses in which the beneficiary may edit the campaign content. */
export const EDITABLE_STATUSES: CampaignStatus[] = ['DRAFT', 'ADDITIONAL_INFO_REQUIRED', 'REJECTED'];

/** Statuses that count against the per-user open-campaign limit. */
export const OPEN_STATUSES: CampaignStatus[] = ['DRAFT', 'PENDING', 'UNDER_REVIEW', 'ADDITIONAL_INFO_REQUIRED', 'APPROVED', 'PUBLISHED'];

export const PUBLIC_STATUSES: CampaignStatus[] = ['PUBLISHED', 'CLOSED'];

export const STATUS_LABEL: Record<CampaignStatus, string> = {
  DRAFT: 'Draft',
  PENDING: 'Pending approval',
  UNDER_REVIEW: 'Under review',
  ADDITIONAL_INFO_REQUIRED: 'Additional information required',
  APPROVED: 'Approved',
  PUBLISHED: 'Live',
  REJECTED: 'Rejected',
  CLOSED: 'Closed',
};

export const MAX_OPEN_CAMPAIGNS_PER_USER = 3;
