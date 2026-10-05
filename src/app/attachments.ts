import type { EntryId } from '@/domain/types';
import { extensionOf, fileTypeOf, sanitizeName } from '@/domain/names';
import { encodeHrefPath, relativePath } from '@/domain/paths';
import { ws } from './app-store';
import { MAX_IMPORT_FILE_BYTES } from './importer';

export const ATTACHMENTS_FOLDER = 'assets';

const IMAGE_EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
};

/**
 * Saves a pasted/dropped file into an `assets/` folder beside the document and
 * returns Markdown that references it with a portable relative path.
 */
export async function saveAttachment(docId: EntryId, file: File): Promise<string> {
  const workspace = ws();
  const doc = workspace.get(docId);
  if (!doc) throw new Error('The document no longer exists.');
  if (file.size > MAX_IMPORT_FILE_BYTES) throw new Error('Attachments can be at most 100 MB.');
  const folder = await workspace.ensureFolder(doc.parentId, ATTACHMENTS_FOLDER);
  let name = sanitizeName(file.name || 'image', 'attachment');
  // Pasted screenshots are often named "image.png"; give them a timestamp.
  if (!file.name || /^image\.\w+$/i.test(file.name)) {
    const ext = IMAGE_EXT_BY_MIME[file.type] ?? (extensionOf(name) || 'png');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    name = `Pasted image ${stamp}.${ext}`;
  }
  const entry = await workspace.createFile(folder.id, name, file);
  const tree = workspace.tree;
  const href = encodeHrefPath(relativePath(tree.dirOf(docId), tree.pathOf(entry.id)));
  const label = entry.name.replace(/\.[^.]+$/, '');
  return fileTypeOf(entry.name) === 'image' ? `![${label}](${href})` : `[${entry.name}](${href})`;
}
