import { parse, stringify } from 'yaml';
import { splitFrontMatter } from './markdown-scan';

export type FrontMatter = Record<string, unknown>;

export function parseFrontMatter(src: string): FrontMatter | null {
  const { raw } = splitFrontMatter(src);
  if (raw === null) return null;
  try {
    const data: unknown = parse(raw, { maxAliasCount: 10 });
    return data && typeof data === 'object' && !Array.isArray(data) ? (data as FrontMatter) : null;
  } catch {
    return null;
  }
}

/** Returns the document with its front matter replaced by `data` (removed if empty). */
export function withFrontMatter(src: string, data: FrontMatter): string {
  const { bodyOffset } = splitFrontMatter(src);
  const body = src.slice(bodyOffset);
  if (!Object.keys(data).length) return body;
  return `---\n${stringify(data).trimEnd()}\n---\n${body}`;
}

/** Strips front matter for rendering. */
export function stripFrontMatter(src: string): { body: string; data: FrontMatter | null; lineOffset: number } {
  const { bodyOffset } = splitFrontMatter(src);
  const head = src.slice(0, bodyOffset);
  return {
    body: src.slice(bodyOffset),
    data: parseFrontMatter(src),
    lineOffset: bodyOffset ? head.split('\n').length - 1 : 0,
  };
}
