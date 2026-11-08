import { KB, type KbEntry } from './kb';

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

/** Keyword scoring over the knowledge base. Returns the best entries, highest score first. */
export function retrieve(message: string, limit = 3): KbEntry[] {
  const text = ` ${norm(message)} `;
  const scored = KB.map((e) => {
    let score = 0;
    for (const k of e.keywords) if (text.includes(` ${norm(k)} `) || text.includes(norm(k))) score += k.includes(' ') ? 3 : 2;
    if (text.includes(` ${norm(e.topic)} `)) score += 2;
    return { e, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.e);
}

export function wantsHuman(message: string): boolean {
  return /\b(talk to (a )?(person|human|agent)|human|escalate|complaint|urgent)\b/i.test(message);
}
