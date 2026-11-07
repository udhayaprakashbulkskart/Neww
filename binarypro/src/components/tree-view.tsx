'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { TreeNode } from '@/lib/server/tree';

/** Interactive binary tree: zoom, pan with scroll, click a member to focus their team. */
export function TreeView({ root, viewerId }: { root: TreeNode; viewerId: string }) {
  const [zoom, setZoom] = useState(1);
  return (
    <div className="relative">
      <div className="absolute right-0 top-0 z-10 flex gap-2">
        <button className="btn btn-ghost px-3 py-1.5 text-xs" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))} aria-label="Zoom out">−</button>
        <button className="btn btn-ghost px-3 py-1.5 text-xs" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
        <button className="btn btn-ghost px-3 py-1.5 text-xs" onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))} aria-label="Zoom in">+</button>
      </div>
      <div className="overflow-auto rounded-2xl bg-[radial-gradient(circle_at_50%_0%,rgba(255,106,0,.10),transparent_60%)] p-6 pt-12" style={{ maxHeight: '70vh' }}>
        <div className="mx-auto w-max origin-top transition-transform" style={{ transform: `scale(${zoom})` }}>
          <Branch node={root} viewerId={viewerId} />
        </div>
      </div>
    </div>
  );
}

function Branch({ node, viewerId }: { node: TreeNode | null; viewerId: string }) {
  if (!node) {
    return (
      <div className="grid h-[68px] w-36 place-items-center rounded-2xl border border-dashed border-white/10 text-[11px] uppercase tracking-widest text-[#6f6758]">Open slot</div>
    );
  }
  const isMe = node.id === viewerId;
  return (
    <div className="flex flex-col items-center">
      <Link
        href={isMe ? '/tree' : `/tree?root=${node.id}`}
        className={`group relative w-40 rounded-2xl border p-3 text-center transition hover:-translate-y-0.5 ${
          isMe ? 'border-[#d4af37] bg-[linear-gradient(180deg,#1f1706,#0b0a06)] shadow-[0_0_30px_rgba(212,175,55,.18)]' : 'border-white/10 bg-[#0c0c0c] hover:border-[#ff6a00]/60'
        }`}
      >
        <div className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-full bg-[linear-gradient(135deg,#ff6a00,#d4af37)] text-xs font-black text-black">{node.name.slice(0, 1).toUpperCase()}</div>
        <div className="truncate text-sm font-bold">{node.name}</div>
        <div className="mt-1 flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-wider text-[#a39a86]">
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${node.active ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
          {node.tier ?? 'No plan'}
        </div>
      </Link>
      {(node.left || node.right) && (
        <div className="relative mt-8 flex gap-8 pt-8">
          <span className="absolute left-1/2 top-0 h-8 w-px -translate-x-1/2 bg-gradient-to-b from-[#d4af37] to-transparent" />
          <span className="absolute left-[25%] right-[25%] top-8 h-px bg-[#2a2116]" />
          <div className="relative flex flex-col items-center"><span className="absolute -top-8 left-1/2 h-8 w-px bg-[#2a2116]" /><Branch node={node.left} viewerId={viewerId} /></div>
          <div className="relative flex flex-col items-center"><span className="absolute -top-8 left-1/2 h-8 w-px bg-[#2a2116]" /><Branch node={node.right} viewerId={viewerId} /></div>
        </div>
      )}
      {!node.left && !node.right && <div className="h-0" />}
    </div>
  );
}
