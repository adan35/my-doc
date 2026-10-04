import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { useEditor } from '@/app/editor-store';
import { editorActions } from '@/app/editor-store';
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
    <span className="flex items-center gap-1.5 text-caption whitespace-nowrap text-steel" role="status" aria-live="polite" title={status === 'error' ? `${error ?? ''} Your changes are kept and will be retried.` : online ? 'Saved on this device' : 'Offline: saved on this device'}>
      {status === 'error' ? (
        <button type="button" className="flex items-center gap-1 text-danger hover:underline" onClick={() => void editorActions.flush(id)}>
          <AlertCircle size={14} aria-hidden /> {label} · Retry
        </button>
      ) : (
        <>
          {status === 'saving' ? <Loader2 size={13} className="animate-spin" aria-hidden /> : status === 'saved' ? <Check size={13} aria-hidden /> : <span className="size-1.5 rounded-full bg-warning" aria-hidden />}
          <span className="hidden sm:inline">{label}</span>
        </>
      )}
    </span>
  );
}
