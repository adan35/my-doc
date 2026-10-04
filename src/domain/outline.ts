import { blankInlineCode, proseLines } from './markdown-scan';

export interface Heading {
  level: number;
  text: string;
  /** 0-based source line. */
  line: number;
  /** Anchor slug, unique within the document. */
  slug: string;
}

/** GitHub-style slug, shared with the renderer so outline clicks find their anchors. */
export function slugify(text: string): string {
  return (
    text
      .trim()
      .toLocaleLowerCase()
      .replace(/<[^>]+>/g, '')
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .replace(/\s+/g, '-') || 'section'
  );
}

export function uniqueSlugger(): (text: string) => string {
  const seen = new Map<string, number>();
  return (text) => {
    const base = slugify(text);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n ? `${base}-${n}` : base;
  };
}

/** Strips inline Markdown so headings read cleanly in the outline. */
export function plainInline(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, a: string, b?: string) => b ?? a)
    .replace(/[*_~`]+/g, '')
    .replace(/\s+#+\s*$/, '')
    .trim();
}

export function extractHeadings(src: string): Heading[] {
  const slug = uniqueSlugger();
  const out: Heading[] = [];
  const lines = src.split('\n');
  for (const line of proseLines(src)) {
    const atx = /^ {0,3}(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/.exec(line.text);
    let level = 0;
    let raw = '';
    if (atx) {
      level = atx[1]!.length;
      raw = atx[2]!;
    } else {
      // Setext headings: a text line followed by === or ---.
      const next = lines[line.index + 1];
      if (next !== undefined && line.text.trim() && !/^\s*([-*+]|\d+\.)\s/.test(line.text)) {
        if (/^ {0,3}=+\s*$/.test(next)) level = 1;
        else if (/^ {0,3}-+\s*$/.test(next) && !/^\s*$/.test(line.text)) level = 2;
        raw = line.text.trim();
      }
    }
    if (!level) continue;
    const text = plainInline(blankInlineCode(raw) === raw ? raw : raw.replace(/`/g, ''));
    if (!text) continue;
    out.push({ level, text, line: line.index, slug: slug(text) });
  }
  return out;
}
