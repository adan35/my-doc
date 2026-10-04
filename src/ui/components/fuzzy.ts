/**
 * Small fuzzy matcher for palette-style lists: rewards consecutive matches,
 * word starts and early positions. Returns null when not all chars match.
 */
export function fuzzyScore(query: string, text: string): { score: number; positions: number[] } | null {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (!q) return { score: 0, positions: [] };
  const direct = t.indexOf(q);
  if (direct >= 0) {
    const atWord = direct === 0 || /[\s/_\-.]/.test(t[direct - 1]!);
    return { score: 1000 - direct + (atWord ? 200 : 0) - t.length * 0.5, positions: Array.from({ length: q.length }, (_, i) => direct + i) };
  }
  let score = 0;
  let ti = 0;
  let prev = -2;
  const positions: number[] = [];
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found < 0) return null;
    positions.push(found);
    if (found === prev + 1) score += 15;
    if (found === 0 || /[\s/_\-.]/.test(t[found - 1]!)) score += 10;
    score -= found - ti;
    prev = found;
    ti = found + 1;
  }
  return { score: score - t.length * 0.5, positions };
}
