import MiniSearch, { type SearchResult as MiniResult } from 'minisearch';
import type { EntryId } from '@/domain/types';
import type { Tree } from '@/domain/tree';
import { fileTypeOf, type FileType } from '@/domain/names';

/** Content beyond this many characters isn't indexed (the file still opens fine). */
const MAX_INDEXED_CHARS = 1_000_000;

interface IndexedDoc {
  id: EntryId;
  name: string;
  path: string;
  content: string;
  tags: string;
}

export interface SearchFilters {
  types?: FileType[];
  folderId?: EntryId | null;
  tag?: string;
}

export interface SearchHit {
  id: EntryId;
  score: number;
  /** Which fields matched: used to label results. */
  fields: string[];
  terms: string[];
  snippet?: Snippet;
}

export interface Snippet {
  text: string;
  /** [start, end) ranges within `text` to highlight. */
  highlights: [number, number][];
}

/**
 * Full-text search over names, paths, tags and content. Pluggable by design: a
 * semantic ranker can be added later behind the same `search()` signature.
 */
export class SearchIndex {
  private mini = this.createMini();
  private docs = new Map<EntryId, IndexedDoc>();

  private createMini() {
    return new MiniSearch<IndexedDoc>({
      fields: ['name', 'path', 'tags', 'content'],
      storeFields: [],
      searchOptions: {
        boost: { name: 4, tags: 3, path: 1.5, content: 1 },
        prefix: true,
        fuzzy: (term) => (term.length > 3 ? 0.2 : false),
        combineWith: 'AND',
      },
      tokenize: (text) => text.split(/[\s\-_./\\,;:!?'"()[\]{}<>|`*#=+~^@$%&]+/u).filter(Boolean),
      processTerm: (term) => term.toLocaleLowerCase(),
    });
  }

  clear() {
    this.mini = this.createMini();
    this.docs.clear();
  }

  get size() {
    return this.docs.size;
  }

  upsert(id: EntryId, name: string, path: string, content: string, tags: string[]) {
    const doc: IndexedDoc = {
      id,
      name,
      path,
      content: content.length > MAX_INDEXED_CHARS ? content.slice(0, MAX_INDEXED_CHARS) : content,
      tags: tags.join(' '),
    };
    if (this.docs.has(id)) this.mini.discard(id);
    this.docs.set(id, doc);
    this.mini.add(doc);
  }

  remove(id: EntryId) {
    if (!this.docs.has(id)) return;
    this.mini.discard(id);
    this.docs.delete(id);
  }

  /** Bulk-add in chunks so big workspaces don't block the main thread. */
  async addAll(items: IndexedDoc[]): Promise<void> {
    for (const d of items) {
      if (this.docs.has(d.id)) this.mini.discard(d.id);
      this.docs.set(d.id, d);
    }
    await this.mini.addAllAsync(items, { chunkSize: 200 });
  }

  search(query: string, tree: Tree, filters: SearchFilters = {}, limit = 50): SearchHit[] {
    const q = query.trim();
    if (!q) return [];
    let results: MiniResult[] = this.mini.search(q);
    if (!results.length) results = this.mini.search(q, { combineWith: 'OR' });
    const hits: SearchHit[] = [];
    for (const r of results) {
      const id = r.id as EntryId;
      const entry = tree.get(id);
      if (!entry || tree.isTrashed(id)) continue;
      if (filters.types?.length && !filters.types.includes(fileTypeOf(entry.name))) continue;
      if (filters.folderId && !tree.isWithin(id, filters.folderId)) continue;
      const doc = this.docs.get(id);
      if (filters.tag && !doc?.tags.split(' ').includes(filters.tag)) continue;
      const fields = [...new Set(Object.values(r.match).flat())];
      hits.push({
        id,
        score: r.score,
        fields,
        terms: r.terms,
        snippet: doc && fields.includes('content') ? makeSnippet(doc.content, r.terms) : undefined,
      });
      if (hits.length >= limit) break;
    }
    return hits;
  }

  /** Searches only names/paths: used by quick open. */
  suggestNames(query: string): EntryId[] {
    return this.mini
      .search(query, { fields: ['name', 'path'], prefix: true, fuzzy: 0.2, combineWith: 'AND' })
      .map((r) => r.id as EntryId);
  }
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Builds a short excerpt around the first match with highlight ranges. */
export function makeSnippet(content: string, terms: string[], radius = 70): Snippet | undefined {
  if (!terms.length) return undefined;
  const re = new RegExp(terms.map(escapeRe).sort((a, b) => b.length - a.length).join('|'), 'giu');
  const first = re.exec(content);
  if (!first) return undefined;
  let start = Math.max(0, first.index - radius);
  let end = Math.min(content.length, first.index + first[0].length + radius * 2);
  // Snap to word boundaries.
  if (start > 0) start = content.indexOf(' ', start) + 1 || start;
  if (end < content.length) end = content.lastIndexOf(' ', end) > first.index ? content.lastIndexOf(' ', end) : end;
  const raw = content.slice(start, end);
  // Collapse whitespace while tracking offsets.
  let text = '';
  const map: number[] = [];
  let prevSpace = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!;
    const space = /\s/.test(ch);
    if (space && prevSpace) continue;
    map[i] = text.length;
    text += space ? ' ' : ch;
    prevSpace = space;
  }
  const highlights: [number, number][] = [];
  re.lastIndex = 0;
  for (const m of raw.matchAll(re)) {
    const s = map[m.index!];
    const e = map[m.index! + m[0].length - 1];
    if (s !== undefined && e !== undefined) highlights.push([s, e + 1]);
  }
  return {
    text: `${start > 0 ? '…' : ''}${text}${end < content.length ? '…' : ''}`,
    highlights: start > 0 ? highlights.map(([a, b]) => [a + 1, b + 1]) : highlights,
  };
}
