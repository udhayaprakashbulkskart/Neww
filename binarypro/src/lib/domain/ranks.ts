// Rank qualification. Ranks are earned from verified retail volume and active sponsorships, never from
// recruitment alone. Thresholds are launch defaults for owner confirmation.

import type { Rank } from './rank-type';

export interface RankRequirement {
  rank: Rank;
  activeDirects: number;
  teamPvInrMinor: bigint;
}

export const RANK_LADDER: RankRequirement[] = [
  { rank: 'SENIOR_MEMBER', activeDirects: 2, teamPvInrMinor: 5_000_000n },
  { rank: 'TEAM_LEADER', activeDirects: 3, teamPvInrMinor: 50_000_000n },
  { rank: 'MANAGER', activeDirects: 4, teamPvInrMinor: 200_000_000n },
  { rank: 'DIRECTOR', activeDirects: 5, teamPvInrMinor: 1_000_000_000n },
  { rank: 'AMBASSADOR', activeDirects: 6, teamPvInrMinor: 5_000_000_000n },
];

/** Highest rank whose requirements are fully met. Ranks never go down automatically. */
export function evaluateRank(activeDirects: number, teamPvInrMinor: bigint, current: Rank = 'MEMBER'): Rank {
  let achieved: Rank = 'MEMBER';
  for (const req of RANK_LADDER) {
    if (activeDirects >= req.activeDirects && teamPvInrMinor >= req.teamPvInrMinor) achieved = req.rank;
  }
  const order: Rank[] = ['MEMBER', 'SENIOR_MEMBER', 'TEAM_LEADER', 'MANAGER', 'DIRECTOR', 'AMBASSADOR'];
  return order.indexOf(achieved) >= order.indexOf(current) ? achieved : current;
}
