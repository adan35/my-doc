/** Toggles a Markdown task checkbox (`- [ ]` ↔ `- [x]`) on a 0-based source line. */
export function toggleTaskAt(src: string, line: number): string {
  const lines = src.split('\n');
  const text = lines[line];
  if (text === undefined) return src;
  const next = text.replace(/^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\])/, (_m, a: string, c: string, b: string) => `${a}${c === ' ' ? 'x' : ' '}${b}`);
  if (next === text) return src;
  lines[line] = next;
  return lines.join('\n');
}

export function countWords(src: string): number {
  const m = src.match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu);
  return m ? m.length : 0;
}
