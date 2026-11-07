export type Side = 'LEFT' | 'RIGHT';
export const SIDES: Side[] = ['LEFT', 'RIGHT'];
export const otherSide = (s: Side): Side => (s === 'LEFT' ? 'RIGHT' : 'LEFT');
