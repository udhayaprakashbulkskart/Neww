import { Reveal } from '@/components/reveal';

/** Binary tree illustration. Lines draw in when the section scrolls into view, and member nodes pulse. */
export function TreeArt() {
  const nodes = [
    { x: 300, y: 60, r: 10 },
    { x: 170, y: 160, r: 8 }, { x: 430, y: 160, r: 8 },
    { x: 100, y: 260, r: 6 }, { x: 240, y: 260, r: 6 }, { x: 360, y: 260, r: 6 }, { x: 500, y: 260, r: 6 },
  ];
  const links = [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]];
  return (
    <Reveal>
      <svg viewBox="0 0 600 320" className="mx-auto w-full max-w-2xl" role="img" aria-label="Binary team: members placed on a left and right side of each leader">
        <defs>
          <linearGradient id="tree-line" x1="0" x2="1"><stop offset="0" stopColor="#ff6a00" /><stop offset="1" stopColor="#d4af37" /></linearGradient>
          <radialGradient id="tree-node" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#fff3c4" /><stop offset="1" stopColor="#d4af37" /></radialGradient>
        </defs>
        {links.map(([a, b], i) => (
          <line key={i} className="draw-line" style={{ animationDelay: `${i * 180}ms` }} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} stroke="url(#tree-line)" strokeWidth="2.5" strokeLinecap="round" />
        ))}
        {nodes.map((n, i) => (
          <g key={i}>
            <circle cx={n.x} cy={n.y} r={n.r * 2.4} fill="#ff6a00" opacity=".08" />
            <circle className="pulse-node" style={{ animationDelay: `${i * 300}ms` }} cx={n.x} cy={n.y} r={n.r} fill="url(#tree-node)" />
          </g>
        ))}
        <text x="300" y="304" textAnchor="middle" fill="#8f8672" fontSize="13" letterSpacing="2">LEFT · RIGHT · MATCHED VOLUME</text>
      </svg>
    </Reveal>
  );
}
