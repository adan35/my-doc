/** Renders text with highlighted character positions or ranges. Never uses innerHTML. */
export function Highlight({ text, positions, ranges }: { text: string; positions?: number[]; ranges?: [number, number][] }) {
  const marks = new Set<number>(positions ?? []);
  for (const [a, b] of ranges ?? []) for (let i = a; i < b; i++) marks.add(i);
  if (!marks.size) return <>{text}</>;
  const out: React.ReactNode[] = [];
  let buf = '';
  let inMark = false;
  const flush = (k: number) => {
    if (!buf) return;
    out.push(inMark ? <mark key={k} className="hl">{buf}</mark> : buf);
    buf = '';
  };
  for (let i = 0; i < text.length; i++) {
    const m = marks.has(i);
    if (m !== inMark) {
      flush(i);
      inMark = m;
    }
    buf += text[i];
  }
  flush(text.length);
  return <>{out}</>;
}
