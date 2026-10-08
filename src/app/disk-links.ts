import { openDB, type IDBPDatabase } from 'idb';
import { create } from 'zustand';
import type { EntryId } from '@/domain/types';

/**
 * Links between workspace documents and the files on the user's computer they were
 * imported from. Where the browser supports the File System Access API (Chrome, Edge),
 * every save of a linked document is also written back to the original file. Elsewhere
 * there are no links: imported files are edited in the workspace and exported by download.
 *
 * Handles are kept in their own IndexedDB database, keyed by workspace and entry, so the
 * link survives reloads. The browser may ask again for permission after a restart; until
 * then the document shows an "Allow saving to disk" button (permission needs a click).
 */

export type DiskLinkState = 'synced' | 'writing' | 'needs-permission' | 'error';

export interface DiskLink {
  /** File name on disk (it can differ from the document name after a rename). */
  fileName: string;
  state: DiskLinkState;
  error?: string;
}

export const useDiskLinks = create<{ links: Record<EntryId, DiskLink> }>(() => ({ links: {} }));

interface PermissionHandle extends FileSystemFileHandle {
  queryPermission?(d: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission?(d: { mode: 'readwrite' }): Promise<PermissionState>;
}

const DB = 'mydoc-disk-links';
/** Permission prompts shown right after an import; later files ask on their own button. */
const MAX_PROMPTS = 3;
const STORE = 'links';
const handles = new Map<EntryId, PermissionHandle>();
/** Latest text waiting to be written, per document; writes are serialized per file. */
const pendingText = new Map<EntryId, string>();
const writing = new Map<EntryId, Promise<void>>();
let workspaceId: string | null = null;
let dbPromise: Promise<IDBPDatabase> | null = null;

function db() {
  dbPromise ??= openDB(DB, 1, {
    upgrade(d) {
      d.createObjectStore(STORE);
    },
  });
  return dbPromise;
}

const key = (id: EntryId) => `${workspaceId}:${id}`;

function setLink(id: EntryId, link: DiskLink | null) {
  useDiskLinks.setState((s) => {
    const links = { ...s.links };
    if (link) links[id] = link;
    else delete links[id];
    return { links };
  });
}

function patch(id: EntryId, p: Partial<DiskLink>) {
  const cur = useDiskLinks.getState().links[id];
  if (cur) setLink(id, { ...cur, ...p });
}

/** Whether this browser can write imported files back to disk. */
export function canSaveToDisk(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window;
}

async function permission(h: PermissionHandle, ask: boolean): Promise<PermissionState> {
  try {
    if (ask && h.requestPermission) return await h.requestPermission({ mode: 'readwrite' });
    if (h.queryPermission) return await h.queryPermission({ mode: 'readwrite' });
    return 'granted';
  } catch {
    // requestPermission throws without a user gesture.
    return 'prompt';
  }
}

function describe(err: unknown): string {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotFoundError') return 'The original file was moved or deleted.';
  if (name === 'NotAllowedError') return 'Permission to edit the file was denied.';
  if (name === 'NoModificationAllowedError') return 'The file is read-only or locked.';
  return err instanceof Error ? err.message : 'Unable to write the file.';
}

async function writeNow(id: EntryId, ask: boolean): Promise<void> {
  const h = handles.get(id);
  if (!h) return;
  for (;;) {
    const text = pendingText.get(id);
    if (text === undefined) return;
    if ((await permission(h, ask)) !== 'granted') {
      patch(id, { state: 'needs-permission', error: undefined });
      return;
    }
    pendingText.delete(id);
    patch(id, { state: 'writing' });
    try {
      const out = await h.createWritable();
      await out.write(text);
      await out.close();
      patch(id, { state: 'synced', error: undefined });
    } catch (err) {
      // Keep the text so Retry writes the latest version.
      if (!pendingText.has(id)) pendingText.set(id, text);
      patch(id, { state: 'error', error: describe(err) });
      return;
    }
  }
}

function schedule(id: EntryId, ask: boolean): Promise<void> {
  const prev = writing.get(id) ?? Promise.resolve();
  const next = prev.then(() => writeNow(id, ask));
  writing.set(id, next);
  void next.finally(() => writing.get(id) === next && writing.delete(id));
  return next;
}

export const diskLinks = {
  /** Loads the links of a workspace (called when a workspace opens). */
  async load(wsId: string, liveIds: (id: EntryId) => boolean): Promise<void> {
    workspaceId = wsId;
    handles.clear();
    pendingText.clear();
    useDiskLinks.setState({ links: {} });
    if (!canSaveToDisk()) return;
    try {
      const store = (await db()).transaction(STORE).store;
      const links: Record<EntryId, DiskLink> = {};
      for (let c = await store.openCursor(); c; c = await c.continue()) {
        const k = String(c.key);
        if (!k.startsWith(`${wsId}:`)) continue;
        const id = k.slice(wsId.length + 1);
        if (!liveIds(id)) continue;
        const h = c.value as PermissionHandle;
        handles.set(id, h);
        links[id] = { fileName: h.name, state: 'synced' };
      }
      if (workspaceId !== wsId) return;
      useDiskLinks.setState({ links });
      for (const [id, h] of handles) {
        if ((await permission(h, false)) !== 'granted') patch(id, { state: 'needs-permission' });
      }
    } catch {
      // Links are a convenience; the workspace copy is always the source of truth.
    }
  },

  /** Links a document to the file it was imported from. */
  async link(id: EntryId, handle: FileSystemFileHandle): Promise<void> {
    const h = handle as PermissionHandle;
    handles.set(id, h);
    setLink(id, { fileName: h.name, state: 'synced' });
    try {
      await (await db()).put(STORE, h, key(id));
    } catch {
      /* the link still works until reload */
    }
  },

  async unlink(id: EntryId): Promise<void> {
    if (!handles.has(id)) return;
    handles.delete(id);
    pendingText.delete(id);
    setLink(id, null);
    try {
      await (await db()).delete(STORE, key(id));
    } catch {
      /* ignore */
    }
  },

  isLinked(id: EntryId): boolean {
    return handles.has(id);
  },

  /** Writes a document's saved text to its file on disk, if it has one. */
  write(id: EntryId, text: string): Promise<void> {
    if (!handles.has(id)) return Promise.resolve();
    pendingText.set(id, text);
    return schedule(id, false);
  },

  /**
   * Asks for write permission (must run from a click) and writes the latest text.
   * Returns whether the file is now in sync.
   */
  async allow(id: EntryId, text: string): Promise<boolean> {
    const h = handles.get(id);
    if (!h) return false;
    pendingText.set(id, text);
    await schedule(id, true);
    return useDiskLinks.getState().links[id]?.state === 'synced';
  },

  /**
   * Asks once for write permission on freshly picked files, while the click that opened
   * the picker still counts as a user gesture. Stops at the first refusal so a large
   * import never turns into a stack of prompts; the rest ask when first edited.
   */
  async requestAll(ids: EntryId[]): Promise<void> {
    for (const [i, id] of ids.entries()) {
      const h = handles.get(id);
      if (!h) continue;
      const state = await permission(h, i < MAX_PROMPTS);
      if (state !== 'granted') {
        for (const rest of ids.slice(i)) {
          if (handles.has(rest)) patch(rest, { state: 'needs-permission' });
        }
        return;
      }
    }
  },
};
