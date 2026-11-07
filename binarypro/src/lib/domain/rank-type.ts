export const RANKS = ['MEMBER', 'SENIOR_MEMBER', 'TEAM_LEADER', 'MANAGER', 'DIRECTOR', 'AMBASSADOR'] as const;
export type Rank = (typeof RANKS)[number];
export const RANK_LABELS: Record<Rank, string> = {
  MEMBER: 'Member',
  SENIOR_MEMBER: 'Senior Member',
  TEAM_LEADER: 'Team Leader',
  MANAGER: 'Manager',
  DIRECTOR: 'Director',
  AMBASSADOR: 'Ambassador',
};
