import { useEffect, useState } from 'react';
import { Download, ExternalLink } from 'lucide-react';
import type { Entry } from '@/domain/types';
import { fileTypeOf, formatBytes, mimeOf } from '@/domain/names';
import { ws } from '@/app/app-store';
import { exportEntry } from '@/app/actions';
import { FileIcon } from '../components/FileIcon';
import { useTree } from '../hooks';

/** Files My Doc can't edit as text: shown honestly, with a preview where safe. */
export function BinaryView({ entry }: { entry: Entry }) {
  const tree = useTree()!;
  const type = fileTypeOf(entry.name);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let u: string | null = null;
    let cancelled = false;
    setFailed(false);
    void ws()
      .readBlob(entry.id)
      .then((blob) => {
        if (cancelled) return;
        if (!blob) return setFailed(true);
        const typed = new Blob([blob], {
          type:
            entry.mime && entry.mime !== 'application/octet-stream'
              ? entry.mime
              : mimeOf(entry.name),
        });
        u = URL.createObjectURL(typed);
        setUrl(u);
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      if (u) URL.revokeObjectURL(u);
    };
  }, [entry.id, entry.updatedAt, entry.mime, entry.name]);

  const rows: [string, string][] = [
    ['Type', entry.mime || mimeOf(entry.name)],
    ['Size', formatBytes(entry.size)],
    ['Location', tree.dirOf(entry.id) || 'Workspace root'],
    ['Modified', new Date(entry.updatedAt).toLocaleString()],
    ['Created', new Date(entry.createdAt).toLocaleString()],
  ];

  return (
    <div className="scroll-area h-full">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-10">
        {type === 'image' && url && !failed ? (
          <img
            src={url}
            alt={entry.name}
            className="max-h-[60vh] max-w-full rounded-lg border border-hairline object-contain"
          />
        ) : (
          <div className="flex size-20 items-center justify-center rounded-xl bg-surface text-steel">
            <FileIcon entry={entry} size={36} />
          </div>
        )}
        <div className="text-center">
          <h2 className="text-[18px] font-semibold break-all text-ink">{entry.name}</h2>
          <p className="mt-1 text-caption text-steel">
            {failed
              ? 'The contents of this file could not be read.'
              : type === 'image'
                ? 'Images can be embedded in documents with ![alt](path).'
                : "My Doc can store this file but can't edit it. Download it or open it in another app."}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void exportEntry(entry.id, 'file')}
          >
            <Download size={15} aria-hidden /> Download
          </button>
          {url && (type === 'pdf' || type === 'image') && (
            <a className="btn btn-secondary" href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={15} aria-hidden /> Open in new tab
            </a>
          )}
        </div>
        <dl className="card grid w-full max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-2 p-5 text-[14px]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-steel">{k}</dt>
              <dd className="min-w-0 break-all text-charcoal">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
