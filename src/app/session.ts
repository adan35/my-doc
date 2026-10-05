import type { EntryId } from '@/domain/types';
import { KnowledgeIndex } from './knowledge';
import { SearchIndex } from './search';
import type { Workspace, WorkspaceEvent } from './workspace';

/**
 * A workspace plus the derived indexes that make it searchable and linkable.
 * Indexes are rebuilt on open and updated incrementally as documents change.
 */
export class WorkspaceSession {
  readonly knowledge = new KnowledgeIndex();
  readonly search = new SearchIndex();
  private indexedPaths = new Map<EntryId, string>();
  private unsubscribe: () => void;
  private listeners = new Set<() => void>();
  ready: Promise<void>;

  constructor(readonly workspace: Workspace) {
    this.unsubscribe = workspace.subscribe((e) => this.onEvent(e));
    this.ready = this.buildIndexes();
  }

  /** Notified after indexes change (tags, backlinks, search). */
  onIndexChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    for (const fn of this.listeners) fn();
  }

  private async buildIndexes() {
    const tree = this.workspace.tree;
    const texts = this.workspace.allTexts();
    const docs = [];
    for (const e of tree.liveEntries()) {
      const text = e.kind === 'file' ? (texts.get(e.id) ?? '') : '';
      if (e.kind === 'file') this.knowledge.update(e.id, e.name, text);
      const path = tree.pathOf(e.id);
      this.indexedPaths.set(e.id, path);
      docs.push({
        id: e.id,
        name: e.name,
        path,
        content: this.workspace.isEditable(e) ? text : '',
        tags: this.knowledge.tagsOf(e.id).join(' '),
      });
    }
    await this.search.addAll(docs);
    this.notify();
  }

  private indexEntry(id: EntryId) {
    const tree = this.workspace.tree;
    const e = tree.get(id);
    if (!e || tree.isTrashed(id)) {
      this.search.remove(id);
      this.knowledge.remove(id);
      this.indexedPaths.delete(id);
      return;
    }
    const text = e.kind === 'file' ? (this.workspace.allTexts().get(id) ?? '') : '';
    if (e.kind === 'file') this.knowledge.update(id, e.name, text);
    const path = tree.pathOf(id);
    this.indexedPaths.set(id, path);
    this.search.upsert(
      id,
      e.name,
      path,
      this.workspace.isEditable(e) ? text : '',
      this.knowledge.tagsOf(id),
    );
  }

  private onEvent(event: WorkspaceEvent) {
    if (event.type === 'content') {
      for (const id of event.ids) this.indexEntry(id);
    } else {
      // Tree changed: reindex entries whose path or liveness changed.
      const tree = this.workspace.tree;
      const seen = new Set<EntryId>();
      for (const e of tree.liveEntries()) {
        seen.add(e.id);
        if (this.indexedPaths.get(e.id) !== tree.pathOf(e.id)) this.indexEntry(e.id);
      }
      for (const id of [...this.indexedPaths.keys()]) if (!seen.has(id)) this.indexEntry(id);
    }
    this.notify();
  }

  dispose() {
    this.unsubscribe();
    this.listeners.clear();
    this.workspace.store.close();
  }
}
