import { AlertCircle, Check, HardDrive, Loader2 } from 'lucide-react';
import { useEditor } from '@/app/editor-store';
import { editorActions } from '@/app/editor-store';
import { diskLinks, useDiskLinks } from '@/app/disk-links';
import { ws } from '@/app/app-store';
import type { EntryId } from '@/domain/types';
import { useOnline } from '../hooks';

/** Always tells the user what is happening to their data. */
export function SaveStatus({ id }: { id: EntryId }) {
  const status = useEditor((s) => s.buffers[id]?.status);
  const error = useEditor((s) => s.buffers[id]?.error);
  const online = useOnline();
  if (!status || status === 'loading') return null;
  const label =
    status === 'error'
      ? 'Not saved'
      : status === 'saving'
        ? 'Saving…'
        : status === 'unsaved'
          ? 'Unsaved'
          : 'Saved';
  return (
    <span
      className="flex items-center gap-1.5 text-caption whitespace-nowrap text-steel"
      role="status"
      aria-live="polite"
      title={
        status === 'error'
          ? `${error ?? ''} Your changes are kept and will be retried.`
          : online
            ? 'Saved on this device'
            : 'Offline: saved on this device'
      }
    >
      {status === 'error' ? (
        <button
          type="button"
          className="flex items-center gap-1 text-danger hover:underline"
          onClick={() => void editorActions.flush(id)}
        >
          <AlertCircle size={14} aria-hidden /> {label} · Retry
        </button>
      ) : (
        <>
          {status === 'saving' ? (
            <Loader2 size={13} className="animate-spin" aria-hidden />
          ) : status === 'saved' ? (
            <Check size={13} aria-hidden />
          ) : (
            <span className="size-1.5 rounded-full bg-warning" aria-hidden />
          )}
          <span className="hidden sm:inline">{label}</span>
        </>
      )}
    </span>
  );
}

/** For documents imported from the user's computer: is the original file up to date? */
export function DiskStatus({ id }: { id: EntryId }) {
  const link = useDiskLinks((s) => s.links[id]);
  if (!link) return null;
  const allow = () => {
    const b = useEditor.getState().buffers[id];
    const text = b?.savedText ?? ws().allTexts().get(id);
    if (text !== undefined) void diskLinks.allow(id, text);
  };
  if (link.state === 'needs-permission' || link.state === 'error') {
    const permissionNeeded = link.state === 'needs-permission';
    return (
      <button
        type="button"
        className={`btn h-7 gap-1.5 px-2 text-caption whitespace-nowrap ${permissionNeeded ? 'btn-secondary' : 'btn-ghost text-danger'}`}
        title={
          permissionNeeded
            ? `Your edits are saved in My Doc. Allow access to also save them to "${link.fileName}" on your computer.`
            : `${link.error ?? 'Unable to write the file.'} Your edits are still saved in My Doc.`
        }
        onClick={allow}
      >
        {permissionNeeded ? (
          <HardDrive size={13} aria-hidden />
        ) : (
          <AlertCircle size={13} aria-hidden />
        )}
        {permissionNeeded ? 'Allow saving to disk' : 'Disk save failed · Retry'}
      </button>
    );
  }
  return (
    <span
      className="flex items-center gap-1 text-caption whitespace-nowrap text-steel"
      title={`Also saved to "${link.fileName}" on your computer`}
      data-testid="disk-status"
    >
      {link.state === 'writing' ? (
        <Loader2 size={13} className="animate-spin" aria-hidden />
      ) : (
        <HardDrive size={13} aria-hidden />
      )}
      <span className="hidden md:inline">On disk</span>
    </span>
  );
}
