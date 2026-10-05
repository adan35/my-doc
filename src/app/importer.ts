import { unzipSync } from 'fflate';
import type { EntryId, FileContent } from '@/domain/types';
import { fileTypeOf, isTextType, sanitizeName, extensionOf } from '@/domain/names';
import { normalizePath } from '@/domain/paths';
import type { ConflictChoice } from './dialog-store';
import { MAX_TEXT_BYTES, type Workspace } from './workspace';

export const MAX_IMPORT_FILE_BYTES = 100 * 1024 * 1024;
export const MAX_IMPORT_TOTAL_BYTES = 1024 * 1024 * 1024;
const MAX_ZIP_BYTES = 200 * 1024 * 1024;

/** Paths that are never useful to import (OS junk, VCS internals, dependency folders). */
const IGNORED_SEGMENTS = new Set([
  '.git',
  'node_modules',
  '__MACOSX',
  '.DS_Store',
  'Thumbs.db',
  'desktop.ini',
  '.svn',
  '.hg',
]);

export interface ImportItem {
  /** Path relative to the import root, using `/`. */
  path: string;
  file: Blob & { name?: string };
}

export interface ImportResult {
  files: number;
  folders: number;
  replaced: number;
  skipped: { path: string; reason: string }[];
  firstFileId?: EntryId;
}

export type ConflictResolver = (name: string, count: number) => Promise<ConflictChoice>;

/** Decides whether a file is text: by extension, then by sniffing for binary bytes. */
export async function readAsTextIfText(blob: Blob, name: string): Promise<string | null> {
  if (blob.size > MAX_TEXT_BYTES) return null;
  const type = fileTypeOf(name);
  if (type === 'image' || type === 'pdf') return null;
  const known = isTextType(type) && extensionOf(name) !== '';
  const buf = new Uint8Array(await blob.arrayBuffer());
  if (!known) {
    const sample = buf.subarray(0, 8192);
    if (sample.includes(0)) return null;
  }
  try {
    const text = new TextDecoder('utf-8', { fatal: !known }).decode(buf);
    return text.replace(/^\uFEFF/, '');
  } catch {
    return null;
  }
}

/** Expands .zip archives into individual items (with zip-slip protection). */
export async function expandZips(
  items: ImportItem[],
): Promise<{ items: ImportItem[]; skipped: ImportResult['skipped'] }> {
  const out: ImportItem[] = [];
  const skipped: ImportResult['skipped'] = [];
  for (const item of items) {
    if (extensionOf(item.path) !== 'zip') {
      out.push(item);
      continue;
    }
    if (item.file.size > MAX_ZIP_BYTES) {
      skipped.push({ path: item.path, reason: 'Archive is too large to unpack.' });
      continue;
    }
    try {
      const prefix = item.path.replace(/\.zip$/i, '');
      let total = 0;
      const files = unzipSync(new Uint8Array(await item.file.arrayBuffer()), {
        filter: (f) => {
          total += f.originalSize;
          return total <= MAX_IMPORT_TOTAL_BYTES && !f.name.endsWith('/');
        },
      });
      for (const [name, data] of Object.entries(files)) {
        // Zip-slip: entries must stay inside the archive's folder.
        if (normalizePath(name) === null) {
          skipped.push({ path: `${item.path}/${name}`, reason: 'Unsafe path.' });
          continue;
        }
        out.push({ path: `${prefix}/${name}`, file: new Blob([data as Uint8Array<ArrayBuffer>]) });
      }
    } catch {
      skipped.push({ path: item.path, reason: 'This archive could not be read.' });
    }
  }
  return { items: out, skipped };
}

/**
 * Imports files into `targetId`, recreating their folder structure. Never overwrites
 * silently: name conflicts are resolved through `resolveConflict`.
 */
export async function importItems(
  ws: Workspace,
  targetId: EntryId | null,
  rawItems: ImportItem[],
  resolveConflict: ConflictResolver,
  onProgress?: (done: number, total: number) => void,
): Promise<ImportResult> {
  const result: ImportResult = { files: 0, folders: 0, replaced: 0, skipped: [] };
  const expanded = await expandZips(rawItems);
  result.skipped.push(...expanded.skipped);

  // Normalize and validate paths before touching the workspace.
  const items: { segments: string[]; file: Blob }[] = [];
  let total = 0;
  for (const item of expanded.items) {
    const normalized = normalizePath(item.path);
    if (!normalized) {
      result.skipped.push({ path: item.path, reason: 'Unsafe path.' });
      continue;
    }
    const segments = normalized.split('/').map((s) => sanitizeName(s));
    if (segments.some((s) => IGNORED_SEGMENTS.has(s))) continue;
    if (item.file.size > MAX_IMPORT_FILE_BYTES) {
      result.skipped.push({ path: normalized, reason: 'File is larger than 100 MB.' });
      continue;
    }
    total += item.file.size;
    if (total > MAX_IMPORT_TOTAL_BYTES) {
      result.skipped.push({ path: normalized, reason: 'Import is larger than 1 GB.' });
      continue;
    }
    items.push({ segments, file: item.file });
  }

  const folderCache = new Map<string, EntryId | null>([['', targetId]]);
  const folderFor = async (segments: string[]): Promise<EntryId | null> => {
    let key = '';
    let parent = targetId;
    for (const seg of segments) {
      key = key ? `${key}/${seg}` : seg;
      const cached = folderCache.get(key);
      if (cached !== undefined) {
        parent = cached;
        continue;
      }
      const existing = ws.tree
        .childrenOf(parent)
        .find((e) => e.kind === 'folder' && e.name.toLowerCase() === seg.toLowerCase());
      if (existing) parent = existing.id;
      else {
        parent = (await ws.createFolder(parent, seg, { uniquify: true })).id;
        result.folders++;
      }
      folderCache.set(key, parent);
    }
    return parent;
  };

  // New files are created in batches: one commit and one tree event per batch keeps
  // large imports linear instead of rebuilding indexes after every file.
  const BATCH = 250;
  let done = 0;
  let pending: { parentId: EntryId | null; name: string; content: FileContent }[] = [];
  const pendingNames = new Set<string>();
  const flush = async () => {
    if (!pending.length) return;
    const created = await ws.createFiles(pending);
    result.files += created.length;
    result.firstFileId ??= created[0]?.id;
    done += created.length;
    pending = [];
    pendingNames.clear();
    onProgress?.(done, items.length);
  };

  let applyAll: ConflictChoice | null = null;
  for (const { segments, file } of items) {
    const name = segments[segments.length - 1]!;
    const parentId = await folderFor(segments.slice(0, -1));
    const text = await readAsTextIfText(file, name);
    const content = text ?? (file.type ? file : new Blob([file], { type: '' }));
    // A clash with a file queued in this batch is resolved like any other clash.
    if (pendingNames.has(`${parentId}/${name.toLowerCase()}`)) await flush();
    const clash = ws.tree
      .childrenOf(parentId)
      .find((e) => e.name.toLowerCase() === name.toLowerCase());
    if (clash) {
      await flush();
      let choice: ConflictChoice | null = applyAll;
      if (!choice) {
        choice = await resolveConflict(name, items.length - done);
        if (choice.applyToAll) applyAll = choice;
      }
      if (choice.action === 'cancel') {
        result.skipped.push({ path: segments.join('/'), reason: 'Import cancelled.' });
        break;
      }
      if (choice.action === 'skip' || (choice.action === 'replace' && clash.kind === 'folder')) {
        result.skipped.push({ path: segments.join('/'), reason: 'Already exists.' });
        done++;
        continue;
      }
      if (choice.action === 'replace') {
        await ws.replaceContent(clash.id, content);
        result.replaced++;
        result.firstFileId ??= clash.id;
        done++;
        onProgress?.(done, items.length);
        continue;
      }
    }
    pending.push({ parentId, name, content });
    pendingNames.add(`${parentId}/${name.toLowerCase()}`);
    if (pending.length >= BATCH) await flush();
  }
  await flush();
  return result;
}

/** Reads a drag-and-drop DataTransfer, walking dropped folders recursively. */
export async function itemsFromDataTransfer(dt: DataTransfer): Promise<ImportItem[]> {
  const entries = [...dt.items]
    .filter((i) => i.kind === 'file')
    .map((i) => i.webkitGetAsEntry?.())
    .filter((e): e is FileSystemEntry => !!e);
  if (!entries.length) return [...dt.files].map((file) => ({ path: file.name, file }));
  const out: ImportItem[] = [];
  const walk = async (entry: FileSystemEntry, prefix: string): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((res, rej) =>
        (entry as FileSystemFileEntry).file(res, rej),
      );
      out.push({ path: prefix + entry.name, file });
    } else if (entry.isDirectory) {
      if (IGNORED_SEGMENTS.has(entry.name)) return;
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      // readEntries returns results in batches; keep reading until empty.
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((res, rej) =>
          reader.readEntries(res, rej),
        );
        if (!batch.length) break;
        for (const child of batch) await walk(child, `${prefix}${entry.name}/`);
      }
    }
  };
  for (const e of entries) await walk(e, '');
  return out;
}

/** Converts an <input type=file> selection (with or without webkitdirectory). */
export function itemsFromFileList(files: FileList | File[]): ImportItem[] {
  return [...files].map((file) => ({ path: file.webkitRelativePath || file.name, file }));
}
