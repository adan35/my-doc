import type { Entry, EntryId, FileContent, Version, WorkspaceInfo } from '@/domain/types';
import { createId } from '@/domain/ids';
import { StorageError, type ChangeSet, type WorkspaceProvider, type WorkspaceStore } from './types';

/** In-memory provider: used by tests, and a reference implementation of the contract. */
class MemoryWorkspaceStore implements WorkspaceStore {
  entries = new Map<EntryId, Entry>();
  contents = new Map<EntryId, FileContent>();
  versions = new Map<string, Version>();
  meta = new Map<string, unknown>();
  /** Test hook: when set, the next commit throws. */
  failNextCommit = false;

  constructor(readonly info: WorkspaceInfo) {}

  async listEntries() {
    return [...this.entries.values()].map((e) => ({ ...e }));
  }
  async readContent(id: EntryId) {
    return this.contents.get(id);
  }
  async readAllText() {
    const out = new Map<EntryId, string>();
    for (const [id, data] of this.contents) if (typeof data === 'string') out.set(id, data);
    return out;
  }
  async listVersions(entryId: EntryId) {
    return [...this.versions.values()].filter((v) => v.entryId === entryId);
  }
  async commit(c: ChangeSet) {
    if (this.failNextCommit) {
      this.failNextCommit = false;
      throw new StorageError('Simulated write failure.');
    }
    for (const e of c.putEntries ?? []) this.entries.set(e.id, { ...e });
    for (const id of c.deleteEntries ?? []) this.entries.delete(id);
    for (const { id, data } of c.putContents ?? []) this.contents.set(id, data);
    for (const id of c.deleteContents ?? []) this.contents.delete(id);
    for (const v of c.putVersions ?? []) this.versions.set(v.id, v);
    for (const id of c.deleteVersions ?? []) this.versions.delete(id);
  }
  async getMeta<T>(key: string) {
    return this.meta.get(key) as T | undefined;
  }
  async setMeta(key: string, value: unknown) {
    this.meta.set(key, value);
  }
  close() {}
}

export class MemoryProvider implements WorkspaceProvider {
  readonly id = 'memory';
  readonly label = 'Memory (temporary)';
  private workspaces = new Map<string, WorkspaceInfo>();
  readonly stores = new Map<string, MemoryWorkspaceStore>();

  async list() {
    return [...this.workspaces.values()];
  }
  async create(name: string) {
    const info: WorkspaceInfo = { id: createId(), name, createdAt: Date.now(), provider: this.id };
    this.workspaces.set(info.id, info);
    return info;
  }
  async rename(id: string, name: string) {
    const info = this.workspaces.get(id);
    if (info) this.workspaces.set(id, { ...info, name });
  }
  async remove(id: string) {
    this.workspaces.delete(id);
    this.stores.delete(id);
  }
  async open(id: string) {
    const info = this.workspaces.get(id);
    if (!info) throw new StorageError('This workspace no longer exists.');
    let store = this.stores.get(id);
    if (!store) this.stores.set(id, (store = new MemoryWorkspaceStore(info)));
    return store;
  }
}

export type { MemoryWorkspaceStore };
