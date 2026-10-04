import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Clock } from 'lucide-react';
import type { FileType } from '@/domain/names';
import { session } from '@/app/app-store';
import { navigate } from '@/app/router';
import { openEntry } from '@/app/actions';
import { prefs } from '@/app/prefs';
import { Page } from '../components/Page';
import { FileIcon } from '../components/FileIcon';
import { Highlight } from '../components/Highlight';
import { useDebounced, useIndexVersion, useTree } from '../hooks';

const RECENT_KEY = 'mydoc:recent-searches';
const TYPE_FILTERS: { label: string; types: FileType[] }[] = [
  { label: 'Markdown', types: ['markdown'] },
  { label: 'Text & code', types: ['text', 'code', 'data'] },
  { label: 'Images', types: ['image'] },
  { label: 'Other', types: ['pdf', 'binary'] },
];

export function SearchView({ q }: { q: string }) {
  const tree = useTree()!;
  const indexVersion = useIndexVersion();
  const [query, setQuery] = useState(q);
  const [typeIdx, setTypeIdx] = useState<number | null>(null);
  const [tag, setTag] = useState('');
  const [folderId, setFolderId] = useState('');
  const [recent, setRecent] = useState<string[]>(() => prefs.get(RECENT_KEY, []));
  const input = useRef<HTMLInputElement>(null);
  const debounced = useDebounced(query, 120);

  useEffect(() => setQuery(q), [q]);
  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    navigate({ name: 'search', q: debounced }, { replace: true });
    if (debounced.trim().length < 2) return;
    const t = setTimeout(() => {
      setRecent((prev) => {
        const next = [debounced.trim(), ...prev.filter((p) => p !== debounced.trim())].slice(0, 8);
        prefs.set(RECENT_KEY, next);
        return next;
      });
    }, 1500);
    return () => clearTimeout(t);
  }, [debounced]);

  const tags = useMemo(() => session().knowledge.allTags(tree), [tree, indexVersion]);
  const folders = useMemo(() => tree.liveEntries().filter((e) => e.kind === 'folder').map((e) => ({ id: e.id, path: tree.pathOf(e.id) })).sort((a, b) => a.path.localeCompare(b.path)), [tree]);

  const results = useMemo(() => {
    const started = performance.now();
    const hits = session().search.search(debounced, tree, {
      types: typeIdx !== null ? TYPE_FILTERS[typeIdx]!.types : undefined,
      tag: tag || undefined,
      folderId: folderId || undefined,
    }, 100);
    return { hits, ms: performance.now() - started };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, tree, indexVersion, typeIdx, tag, folderId]);

  return (
    <Page title="Search" icon={<Search />}>
      <div className="relative mb-3">
        <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-steel" aria-hidden />
        <input
          ref={input}
          type="search"
          className="input h-11 pr-10 pl-10 text-[16px]"
          placeholder="Search names, paths, tags and content"
          aria-label="Search everything"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results.hits[0]) void openEntry(results.hits[0].id);
          }}
        />
        {query && (
          <button type="button" className="icon-btn absolute top-1/2 right-2 -translate-y-1/2" aria-label="Clear search" onClick={() => setQuery('')}>
            <X size={16} />
          </button>
        )}
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-1.5" role="group" aria-label="Filters">
        {TYPE_FILTERS.map((f, i) => (
          <button key={f.label} type="button" aria-pressed={typeIdx === i} className={`h-7 rounded-full border px-3 text-caption ${typeIdx === i ? 'border-ink bg-ink text-canvas' : 'border-hairline text-steel hover:bg-hover'}`} onClick={() => setTypeIdx(typeIdx === i ? null : i)}>
            {f.label}
          </button>
        ))}
        <select className="input h-7 w-auto max-w-[180px] rounded-full py-0 text-caption" aria-label="Filter by tag" value={tag} onChange={(e) => setTag(e.target.value)}>
          <option value="">Any tag</option>
          {tags.map((t) => (
            <option key={t.tag} value={t.tag}>
              #{t.tag}
            </option>
          ))}
        </select>
        <select className="input h-7 w-auto max-w-[220px] rounded-full py-0 text-caption" aria-label="Filter by folder" value={folderId} onChange={(e) => setFolderId(e.target.value)}>
          <option value="">Everywhere</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.path}
            </option>
          ))}
        </select>
      </div>

      {!debounced.trim() ? (
        recent.length ? (
          <section>
            <h2 className="section-label mb-2">Recent searches</h2>
            <ul className="space-y-px">
              {recent.map((r) => (
                <li key={r}>
                  <button type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[14px] text-charcoal hover:bg-hover" onClick={() => setQuery(r)}>
                    <Clock size={14} className="text-stone" aria-hidden /> {r}
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="mt-2 text-caption text-steel hover:underline" onClick={() => (setRecent([]), prefs.remove(RECENT_KEY))}>
              Clear recent searches
            </button>
          </section>
        ) : (
          <p className="text-[14px] text-steel">Search matches file names, folder paths, #tags and the full text of every document. Typos are forgiven.</p>
        )
      ) : (
        <section aria-live="polite">
          <p className="mb-2 text-caption text-steel">
            {results.hits.length === 100 ? 'Top 100 results' : `${results.hits.length} result${results.hits.length === 1 ? '' : 's'}`} · {results.ms < 1 ? '<1' : Math.round(results.ms)} ms
          </p>
          {results.hits.length === 0 ? (
            <p className="rounded-lg border border-dashed border-hairline-strong p-8 text-center text-[14px] text-steel">No documents match "{debounced}". Try fewer words or remove a filter.</p>
          ) : (
            <ul className="divide-y divide-hairline-soft overflow-hidden rounded-lg border border-hairline">
              {results.hits.map((hit) => {
                const e = tree.get(hit.id);
                if (!e) return null;
                const termRe = hit.terms.length ? new RegExp(hit.terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi') : null;
                const nameRanges: [number, number][] = termRe ? [...e.name.matchAll(termRe)].map((m) => [m.index!, m.index! + m[0].length]) : [];
                return (
                  <li key={hit.id}>
                    <button type="button" className="flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-surface-soft" onClick={() => void openEntry(hit.id)}>
                      <FileIcon entry={e} className="mt-0.5 shrink-0 text-steel" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium text-ink">
                          <Highlight text={e.name} ranges={nameRanges} />
                        </span>
                        <span className="block truncate text-xs text-steel">{tree.dirOf(hit.id).split('/').join(' / ') || 'Workspace root'}</span>
                        {hit.snippet && (
                          <span className="mt-1 line-clamp-2 block text-[13px] text-slate">
                            <Highlight text={hit.snippet.text} ranges={hit.snippet.highlights} />
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </Page>
  );
}
