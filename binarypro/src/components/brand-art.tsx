// Decorative network artwork used behind hero areas (pure SVG, no external assets).
export function NetworkArt({ className = '' }: { className?: string }) {
  const nodes: [number, number, number][] = [
    [60, 80, 5], [150, 40, 4], [240, 110, 6], [330, 50, 4], [420, 130, 5], [520, 60, 6],
    [110, 190, 4], [230, 230, 7], [360, 200, 5], [480, 240, 4], [600, 170, 5],
  ];
  const links: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [0, 6], [2, 7], [6, 7], [7, 8], [8, 9], [9, 10], [4, 10], [8, 4]];
  return (
    <svg viewBox="0 0 680 300" className={className} aria-hidden="true" fill="none">
      <defs>
        <linearGradient id="bp-line" x1="0" x2="1">
          <stop offset="0" stopColor="#ff6a00" stopOpacity="0" />
          <stop offset=".5" stopColor="#d4af37" stopOpacity=".9" />
          <stop offset="1" stopColor="#ff6a00" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="bp-node" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#f7e09a" />
          <stop offset="1" stopColor="#d4af37" stopOpacity=".4" />
        </radialGradient>
      </defs>
      {links.map(([a, b], i) => (
        <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} stroke="url(#bp-line)" strokeWidth="1.2" />
      ))}
      {nodes.map(([x, y, r], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={r * 3} fill="#ff6a00" opacity=".08" />
          <circle cx={x} cy={y} r={r} fill="url(#bp-node)" />
        </g>
      ))}
    </svg>
  );
}
