import { editorActions } from '@/app/editor-store';
import { openEntry } from '@/app/actions';

export type DocCommand = 'find' | 'toggle-mode' | 'split' | 'focus-editor';

/** Sends a command to the active document view (it owns the editor instance). */
export function sendDocCommand(cmd: DocCommand) {
  dispatchEvent(new CustomEvent('mydoc:doc-command', { detail: cmd }));
}

export async function reopenClosedTab() {
  const id = await editorActions.reopenClosed();
  if (id) void openEntry(id);
}
