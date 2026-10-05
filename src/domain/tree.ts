import type { Entry, EntryId } from './types';
import { compareNames } from './names';

/**
 * An immutable, indexed view over a workspace's entries. Built once per change,
 * it answers parent/child/path questions in O(1) or O(depth).
 */
export class Tree {
  readonly byId: ReadonlyMap<EntryId, Entry>;
  private readonly children = new Map<EntryId | null, Entry[]>();
  private readonly pathCache = new Map<EntryId, string>();
  private readonly trashedCache = new Map<EntryId, boolean>();
  private pathIndex: Map<string, EntryId> | null = null;

  constructor(entries: Iterable<Entry>) {
    const byId = new Map<EntryId, Entry>();
    for (const e of entries) byId.set(e.id, e);
    this.byId = byId;
    for (const e of byId.values()) {
      // Orphans (missing parent) are surfaced at the root rather than lost.
      const parent = e.parentId && byId.has(e.parentId) ? e.parentId : null;
      let list = this.children.get(parent);
      if (!list) this.children.set(parent, (list = []));
      list.push(e);
    }
    for (const list of this.children.values()) list.sort(compareEntries);
  }

  get size(): number {
    return this.byId.size;
  }

  get(id: EntryId | null | undefined): Entry | undefined {
    return id ? this.byId.get(id) : undefined;
  }

  /** Children including trashed ones, sorted folders-first then by name. */
  rawChildren(parentId: EntryId | null): readonly Entry[] {
    return this.children.get(parentId) ?? [];
  }

  /** Live (non-trashed) children. */
  childrenOf(parentId: EntryId | null): Entry[] {
    return this.rawChildren(parentId).filter((e) => e.trashedAt === undefined);
  }

  parentOf(id: EntryId): Entry | undefined {
    const e = this.byId.get(id);
    return e?.parentId ? this.byId.get(e.parentId) : undefined;
  }

  /** Ancestors from the root down to (excluding) the entry. */
  ancestors(id: EntryId): Entry[] {
    const result: Entry[] = [];
    const seen = new Set<EntryId>();
    let cur = this.parentOf(id);
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      result.unshift(cur);
      cur = this.parentOf(cur.id);
    }
    return result;
  }

  /** `Folder/Sub/file.md` — the entry's path relative to the workspace root. */
  pathOf(id: EntryId): string {
    const cached = this.pathCache.get(id);
    if (cached !== undefined) return cached;
    const e = this.byId.get(id);
    if (!e) return '';
    const path = [...this.ancestors(id).map((a) => a.name), e.name].join('/');
    this.pathCache.set(id, path);
    return path;
  }

  /** Path of the folder containing the entry ('' for root). */
  dirOf(id: EntryId): string {
    const parent = this.parentOf(id);
    return parent ? this.pathOf(parent.id) : '';
  }

  /** Case-insensitive lookup of a live entry by its workspace path. */
  findByPath(path: string): Entry | undefined {
    if (!this.pathIndex) {
      this.pathIndex = new Map();
      for (const e of this.byId.values()) {
        if (!this.isTrashed(e.id)) this.pathIndex.set(this.pathOf(e.id).toLocaleLowerCase(), e.id);
      }
    }
    const id = this.pathIndex.get(path.toLocaleLowerCase());
    return id ? this.byId.get(id) : undefined;
  }

  /** True if the entry or any ancestor is in the trash. */
  isTrashed(id: EntryId): boolean {
    const cached = this.trashedCache.get(id);
    if (cached !== undefined) return cached;
    const e = this.byId.get(id);
    let result = false;
    if (!e) result = true;
    else if (e.trashedAt !== undefined) result = true;
    else if (e.parentId && this.byId.has(e.parentId)) result = this.isTrashed(e.parentId);
    this.trashedCache.set(id, result);
    return result;
  }

  /** True if `id` is `ancestorId` or lives somewhere beneath it. */
  isWithin(id: EntryId, ancestorId: EntryId): boolean {
    if (id === ancestorId) return true;
    return this.ancestors(id).some((a) => a.id === ancestorId);
  }

  /** All descendants (depth-first), including trashed ones. */
  descendants(id: EntryId): Entry[] {
    const out: Entry[] = [];
    const stack = [...this.rawChildren(id)];
    while (stack.length) {
      const e = stack.pop()!;
      out.push(e);
      stack.push(...this.rawChildren(e.id));
    }
    return out;
  }

  /** Every live entry, in no particular order. */
  liveEntries(): Entry[] {
    return [...this.byId.values()].filter((e) => !this.isTrashed(e.id));
  }

  liveFiles(): Entry[] {
    return this.liveEntries().filter((e) => e.kind === 'file');
  }

  /** Top-level trashed entries, newest first. */
  trashedRoots(): Entry[] {
    return [...this.byId.values()]
      .filter((e) => e.trashedAt !== undefined)
      .sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0));
  }

  /** Checks a move is legal: target exists, is a folder, is live, and isn't inside the source. */
  canMove(id: EntryId, targetParentId: EntryId | null): boolean {
    const e = this.byId.get(id);
    if (!e) return false;
    if (targetParentId === null) return true;
    const target = this.byId.get(targetParentId);
    if (!target || target.kind !== 'folder' || this.isTrashed(target.id)) return false;
    return !this.isWithin(targetParentId, id);
  }
}

export function compareEntries(a: Entry, b: Entry): number {
  if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
  return compareNames(a.name, b.name);
}

export type SortKey = 'name' | 'modified' | 'created' | 'type' | 'size';
export type SortDir = 'asc' | 'desc';

export function sortEntries(entries: Entry[], key: SortKey, dir: SortDir): Entry[] {
  const sign = dir === 'asc' ? 1 : -1;
  const ext = (n: string) => (n.includes('.') ? n.slice(n.lastIndexOf('.') + 1) : '');
  const by: Record<SortKey, (a: Entry, b: Entry) => number> = {
    name: (a, b) => compareNames(a.name, b.name),
    modified: (a, b) => a.updatedAt - b.updatedAt,
    created: (a, b) => a.createdAt - b.createdAt,
    type: (a, b) => compareNames(ext(a.name), ext(b.name)) || compareNames(a.name, b.name),
    size: (a, b) => a.size - b.size,
  };
  return [...entries].sort((a, b) => {
    // Folders always stay grouped first, regardless of direction.
    if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
    return sign * by[key](a, b) || compareNames(a.name, b.name);
  });
}
