import { blankInlineCode, proseLines } from './markdown-scan';
import { parseFrontMatter, withFrontMatter } from './frontmatter';

/** Tag syntax: `#word`, letters/digits/`_`/`-`/`/`, must contain a letter. */
const TAG_RE = /(^|[\s(\[,;])#([\p{L}\p{N}_\-/]*\p{L}[\p{L}\p{N}_\-/]*)/gu;

export function normalizeTag(tag: string): string {
  return tag.replace(/^#/, '').trim().toLocaleLowerCase();
}

export function isValidTag(tag: string): boolean {
  return /^[\p{L}\p{N}_\-/]*\p{L}[\p{L}\p{N}_\-/]*$/u.test(tag);
}

function frontMatterTags(src: string): string[] {
  const fm = parseFrontMatter(src);
  const raw = fm?.tags ?? fm?.tag;
  if (typeof raw === 'string') return raw.split(/[,\s]+/).filter(Boolean);
  if (Array.isArray(raw)) return raw.filter((t): t is string => typeof t === 'string');
  return [];
}

/** All tags in a document (front matter `tags:` plus inline `#tags`), normalized and unique. */
export function extractTags(src: string): string[] {
  const tags = new Set<string>();
  for (const t of frontMatterTags(src)) {
    const n = normalizeTag(t);
    if (isValidTag(n)) tags.add(n);
  }
  for (const line of proseLines(src)) {
    // Skip headings' leading hashes (they need a following space, so the regex already does).
    const text = blankInlineCode(line.text).replace(/\]\([^)]*\)/g, ' ');
    for (const m of text.matchAll(TAG_RE)) tags.add(normalizeTag(m[2]!));
  }
  return [...tags].sort();
}

/** Adds a tag to the document's front matter (creating it when absent). */
export function addTag(src: string, tag: string): string {
  const n = normalizeTag(tag);
  if (!isValidTag(n) || extractTags(src).includes(n)) return src;
  const fm = parseFrontMatter(src) ?? {};
  const existing = frontMatterTags(src);
  return withFrontMatter(src, { ...fm, tags: [...existing, n] });
}

/** Removes a tag from front matter and inline occurrences. */
export function removeTag(src: string, tag: string): string {
  return replaceTag(src, tag, null);
}

/** Renames (or with `to === null`, removes) a tag everywhere in the document. */
export function replaceTag(src: string, from: string, to: string | null): string {
  const target = normalizeTag(from);
  let out = src;
  const fm = parseFrontMatter(src);
  const fmTags = frontMatterTags(src);
  if (fm && fmTags.some((t) => normalizeTag(t) === target)) {
    const next = [
      ...new Set(
        fmTags
          .map((t) => (normalizeTag(t) === target ? to : t))
          .filter((t): t is string => t !== null),
      ),
    ];
    const { tags: _t, tag: _t2, ...rest } = fm;
    out = withFrontMatter(src, next.length ? { ...rest, tags: next } : rest);
  }
  // Rewrite inline tags line by line, outside code.
  const lines = out.split('\n');
  for (const line of [...proseLines(out)]) {
    const masked = blankInlineCode(line.text);
    let result = '';
    let last = 0;
    for (const m of masked.matchAll(TAG_RE)) {
      if (normalizeTag(m[2]!) !== target) continue;
      const start = m.index! + m[1]!.length;
      const end = m.index! + m[0].length;
      result += line.text.slice(last, start) + (to === null ? '' : `#${to}`);
      last = end;
    }
    if (last > 0) {
      let replaced = result + line.text.slice(last);
      if (to === null) replaced = replaced.replace(/[ \t]{2,}/g, ' ').trimEnd();
      lines[line.index] = replaced;
    }
  }
  return lines.join('\n');
}
