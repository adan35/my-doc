import { runImport } from '@/app/actions';
import { itemsFromFileList } from '@/app/importer';

/** Opens the browser's file/folder picker and imports the selection. */
export function pickImport(kind: 'files' | 'folder' | 'zip', targetId?: string | null) {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = kind !== 'zip';
  if (kind === 'folder') input.webkitdirectory = true;
  if (kind === 'zip') input.accept = '.zip,application/zip';
  input.style.display = 'none';
  input.addEventListener('change', () => {
    const files = input.files ? itemsFromFileList(input.files) : [];
    input.remove();
    if (files.length) void runImport(files, targetId === undefined ? undefined : targetId);
  });
  document.body.append(input);
  input.click();
}
