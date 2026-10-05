/**
 * Lightweight Markdown scanning helpers shared by tag, link and outline extraction.
 * These intentionally avoid a full parse: they run on every save for every document.
 */

export interface Line {
  text: string;
  /** Offset of the first character of the line in the source. */
  offset: number;
  /** 0-based line number. */
  index: number;
}

/** Splits front matter (`---\n...\n---`) from the body. */
export function splitFrontMatter(src: string): { raw: string | null; bodyOffset: number } {
  const m = /^---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)\s*(?:\r?\n|$)/.exec(src);
  if (!m) return { raw: null, bodyOffset: 0 };
  return { raw: m[1] ?? '', bodyOffset: m[0].length };
}

/** Yields lines that are prose: outside front matter and fenced code blocks. */
export function* proseLines(src: string): Generator<Line> {
  const { bodyOffset } = splitFrontMatter(src);
  let fence: string | null = null;
  let offset = 0;
  let index = 0;
  for (const text of src.split('\n')) {
    const lineOffset = offset;
    offset += text.length + 1;
    const lineIndex = index++;
    if (lineOffset < bodyOffset) continue;
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})/.exec(text);
    if (fence) {
      if (fenceMatch && fenceMatch[1]![0] === fence[0] && fenceMatch[1]!.length >= fence.length) {
        fence = null;
      }
      continue;
    }
    if (fenceMatch) {
      fence = fenceMatch[1]!;
      continue;
    }
    yield { text, offset: lineOffset, index: lineIndex };
  }
}

/** Replaces inline code spans with spaces so their contents are ignored but offsets are kept. */
export function blankInlineCode(text: string): string {
  return text.replace(/(`+)([\s\S]*?)\1/g, (m) => ' '.repeat(m.length));
}
