import type { EntryId } from '@/domain/types';
import type { Tree } from '@/domain/tree';
import { extractLinks, type RawLink } from '@/domain/links';
import { extractTags } from '@/domain/tags';
import { isMarkdownName } from '@/domain/names';
import { resolvePath } from '@/domain/paths';
import { resolveWikiLink } from './workspace';

interface DocFacts {
  links: RawLink[];
  tags: string[];
}

/**
 * Derived knowledge: tags and links parsed from Markdown. Nothing here is stored;
 * the documents themselves are the source of truth, so exports lose nothing.
 */
export class KnowledgeIndex {
  private facts = new Map<EntryId, DocFacts>();

  update(id: EntryId, name: string, text: string) {
    if (!isMarkdownName(name)) {
      this.facts.delete(id);
      return;
    }
    this.facts.set(id, { links: extractLinks(text), tags: extractTags(text) });
  }

  remove(id: EntryId) {
    this.facts.delete(id);
  }

  tagsOf(id: EntryId): string[] {
    return this.facts.get(id)?.tags ?? [];
  }

  /** All tags with counts, over live documents only. */
  allTags(tree: Tree): { tag: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const [id, f] of this.facts) {
      if (tree.isTrashed(id)) continue;
      for (const t of f.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => a.tag.localeCompare(b.tag));
  }

  docsWithTag(tree: Tree, tag: string): EntryId[] {
    const out: EntryId[] = [];
    for (const [id, f] of this.facts) if (!tree.isTrashed(id) && f.tags.includes(tag)) out.push(id);
    return out;
  }

  /** Resolves a link written in document `fromId` to an entry id. */
  resolve(tree: Tree, fromId: EntryId, link: Pick<RawLink, 'kind' | 'target'>): EntryId | undefined {
    if (link.kind === 'wiki') return resolveWikiLink(tree, link.target)?.id;
    const path = resolvePath(tree.dirOf(fromId), link.target);
    if (path === null) return undefined;
    const hit = tree.findByPath(path);
    if (hit) return hit.id;
    // Allow extension-less links: [x](./notes/today) → today.md
    return tree.findByPath(`${path}.md`)?.id;
  }

  outgoing(tree: Tree, id: EntryId): { link: RawLink; targetId?: EntryId }[] {
    return (this.facts.get(id)?.links ?? []).map((link) => ({
      link,
      targetId: this.resolve(tree, id, link),
    }));
  }

  /** Documents linking to `id`. */
  backlinks(tree: Tree, id: EntryId): EntryId[] {
    const out: EntryId[] = [];
    for (const [from, f] of this.facts) {
      if (from === id || tree.isTrashed(from)) continue;
      if (f.links.some((l) => l.kind !== 'image' && this.resolve(tree, from, l) === id)) out.push(from);
    }
    return out;
  }

  /** Links that point at nothing (useful for "broken link" hints). */
  brokenLinks(tree: Tree, id: EntryId): RawLink[] {
    return this.outgoing(tree, id)
      .filter((o) => !o.targetId)
      .map((o) => o.link);
  }
}
