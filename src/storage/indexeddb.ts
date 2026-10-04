import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Entry, EntryId, FileContent, Version, WorkspaceInfo } from '@/domain/types';
import { createId } from '@/domain/ids';
import { StorageError, type ChangeSet, type WorkspaceProvider, type WorkspaceStore } from './types';

interface RegistrySchema extends DBSchema {
  workspaces: { key: string; value: WorkspaceInfo };
}

interface WorkspaceSchema extends DBSchema {
  entries: { key: string; value: Entry };
  contents: { key: string; value: { id: string; data: FileContent } };
  versions: { key: string; value: Version; indexes: { byEntry: string } };
  meta: { key: string; value: { key: string; value: unknown } };
}

const REGISTRY_DB = 'mydoc-registry';
const workspaceDbName = (id: string) => `mydoc-ws-${id}`;

class IndexedDbWorkspaceStore implements WorkspaceStore {
  constructor(
    readonly info: WorkspaceInfo,
    private readonly db: IDBPDatabase<WorkspaceSchema>,
  ) {}

  listEntries(): Promise<Entry[]> {
    return this.db.getAll('entries');
  }

  async readContent(id: EntryId): Promise<FileContent | undefined> {
    return (await this.db.get('contents', id))?.data;
  }

  async readAllText(): Promise<Map<EntryId, string>> {
    const out = new Map<EntryId, string>();
    let cursor = await this.db.transaction('contents').store.openCursor();
    while (cursor) {
      const { id, data } = cursor.value;
      if (typeof data === 'string') out.set(id, data);
      cursor = await cursor.continue();
    }
    return out;
  }

  listVersions(entryId: EntryId): Promise<Version[]> {
    return this.db.getAllFromIndex('versions', 'byEntry', entryId);
  }

  async commit(c: ChangeSet): Promise<void> {
    try {
      const tx = this.db.transaction(['entries', 'contents', 'versions'], 'readwrite');
      const ops: Promise<unknown>[] = [];
      const entries = tx.objectStore('entries');
      const contents = tx.objectStore('contents');
      const versions = tx.objectStore('versions');
      for (const e of c.putEntries ?? []) ops.push(entries.put(e));
      for (const id of c.deleteEntries ?? []) ops.push(entries.delete(id));
      for (const { id, data } of c.putContents ?? []) ops.push(contents.put({ id, data }));
      for (const id of c.deleteContents ?? []) ops.push(contents.delete(id));
      for (const v of c.putVersions ?? []) ops.push(versions.put(v));
      for (const id of c.deleteVersions ?? []) ops.push(versions.delete(id));
      await Promise.all([...ops, tx.done]);
    } catch (err) {
      throw new StorageError(describeIdbError(err), err);
    }
  }

  async getMeta<T>(key: string): Promise<T | undefined> {
    return (await this.db.get('meta', key))?.value as T | undefined;
  }

  async setMeta(key: string, value: unknown): Promise<void> {
    await this.db.put('meta', { key, value });
  }

  close(): void {
    this.db.close();
  }
}

function describeIdbError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'QuotaExceededError') return 'Your browser storage is full.';
  if (name === 'InvalidStateError') return 'The workspace database was closed.';
  return 'The browser could not write to local storage.';
}

export class IndexedDbProvider implements WorkspaceProvider {
  readonly id = 'indexeddb';
  readonly label = 'This browser (IndexedDB)';
  private registry: Promise<IDBPDatabase<RegistrySchema>> | null = null;

  private reg() {
    this.registry ??= openDB<RegistrySchema>(REGISTRY_DB, 1, {
      upgrade(db) {
        db.createObjectStore('workspaces', { keyPath: 'id' });
      },
    });
    return this.registry;
  }

  async list(): Promise<WorkspaceInfo[]> {
    const all = await (await this.reg()).getAll('workspaces');
    return all.sort((a, b) => a.createdAt - b.createdAt);
  }

  async create(name: string): Promise<WorkspaceInfo> {
    const info: WorkspaceInfo = { id: createId(), name, createdAt: Date.now(), provider: this.id };
    await (await this.reg()).put('workspaces', info);
    return info;
  }

  async rename(id: string, name: string): Promise<void> {
    const db = await this.reg();
    const info = await db.get('workspaces', id);
    if (info) await db.put('workspaces', { ...info, name });
  }

  async remove(id: string): Promise<void> {
    await (await this.reg()).delete('workspaces', id);
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase(workspaceDbName(id));
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    });
  }

  async open(id: string): Promise<WorkspaceStore> {
    const info = await (await this.reg()).get('workspaces', id);
    if (!info) throw new StorageError('This workspace no longer exists.');
    const db = await openDB<WorkspaceSchema>(workspaceDbName(id), 1, {
      upgrade(db) {
        db.createObjectStore('entries', { keyPath: 'id' });
        db.createObjectStore('contents', { keyPath: 'id' });
        const versions = db.createObjectStore('versions', { keyPath: 'id' });
        versions.createIndex('byEntry', 'entryId');
        db.createObjectStore('meta', { keyPath: 'key' });
      },
      blocking() {
        // Another tab is upgrading the schema; let it proceed.
        db.close();
      },
    });
    return new IndexedDbWorkspaceStore(info, db);
  }
}
