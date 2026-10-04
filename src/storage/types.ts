import type { Entry, EntryId, FileContent, Version, WorkspaceInfo } from '@/domain/types';

/**
 * An atomic set of changes. Providers must apply all of it or none of it, so a
 * crash can never leave an entry without its content (or vice versa).
 */
export interface ChangeSet {
  putEntries?: Entry[];
  deleteEntries?: EntryId[];
  putContents?: { id: EntryId; data: FileContent }[];
  deleteContents?: EntryId[];
  putVersions?: Version[];
  deleteVersions?: string[];
}

/**
 * Storage for a single workspace. This is the only seam between My Doc and where
 * bytes physically live; IndexedDB today, a real folder or a cloud provider later.
 */
export interface WorkspaceStore {
  readonly info: WorkspaceInfo;
  listEntries(): Promise<Entry[]>;
  readContent(id: EntryId): Promise<FileContent | undefined>;
  /** Reads all text contents at once (used to build indexes on open). */
  readAllText(): Promise<Map<EntryId, string>>;
  listVersions(entryId: EntryId): Promise<Version[]>;
  commit(changes: ChangeSet): Promise<void>;
  getMeta<T>(key: string): Promise<T | undefined>;
  setMeta(key: string, value: unknown): Promise<void>;
  close(): void;
}

/** Creates, lists and opens workspaces for one provider. */
export interface WorkspaceProvider {
  readonly id: string;
  readonly label: string;
  list(): Promise<WorkspaceInfo[]>;
  create(name: string): Promise<WorkspaceInfo>;
  rename(id: string, name: string): Promise<void>;
  remove(id: string): Promise<void>;
  open(id: string): Promise<WorkspaceStore>;
}

export class StorageError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'StorageError';
  }
}
