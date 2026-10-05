import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
  useImperativeHandle,
} from 'react';
import { createPortal } from 'react-dom';
import type { EntryId } from '@/domain/types';
import { isExternalHref, resolvePath, safeDecode } from '@/domain/paths';
import { renderMarkdown } from '@/lib/markdown/render';
import { renderMermaidIn } from '@/lib/markdown/mermaid';
import { session, ws } from '@/app/app-store';
import { openEntry } from '@/app/actions';
import { slugify } from '@/domain/outline';
import { resolveWikiLink } from '@/app/workspace';
import { toast } from '@/app/toast-store';
import { useResolvedTheme, useTree } from '../hooks';

export interface PreviewHandle {
  scrollToLine(line: number, smooth?: boolean): void;
  scrollToSlug(slug: string): void;
  element: HTMLElement | null;
}

interface Props {
  docId: EntryId;
  text: string;
  className?: string;
  /** Toggle a task checkbox on a given source line. */
  onToggleTask?(line: number): void;
  onVisibleLine?(line: number): void;
  ref?: Ref<PreviewHandle>;
}

/** Object URLs for images stored in the workspace, keyed by entry id. */
const imageUrls = new Map<EntryId, { url: string; updatedAt: number }>();

async function imageUrlFor(id: EntryId): Promise<string | null> {
  const entry = ws().get(id);
  if (!entry) return null;
  const cached = imageUrls.get(id);
  if (cached && cached.updatedAt === entry.updatedAt) return cached.url;
  const blob = await ws().readBlob(id);
  if (!blob) return null;
  // SVGs are rendered via <img>, which never executes their scripts.
  const typed = blob.type ? blob : new Blob([blob], { type: entry.mime ?? '' });
  const url = URL.createObjectURL(typed);
  if (cached) URL.revokeObjectURL(cached.url);
  imageUrls.set(id, { url, updatedAt: entry.updatedAt });
  return url;
}

export function Preview({ docId, text, className = '', onToggleTask, onVisibleLine, ref }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const deferred = useDeferredValue(text);
  const tree = useTree()!;
  const theme = useResolvedTheme();
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null);
  const rendered = useMemo(() => renderMarkdown(deferred), [deferred]);
  const callbacks = useRef({ onToggleTask, onVisibleLine });
  callbacks.current = { onToggleTask, onVisibleLine };

  useImperativeHandle(ref, () => ({
    get element() {
      return root.current;
    },
    scrollToLine(line: number, smooth = false) {
      const container = scrollParent(root.current);
      const el = nearestLineElement(root.current, line);
      if (!container || !el) return;
      const top =
        el.getBoundingClientRect().top -
        container.getBoundingClientRect().top +
        container.scrollTop -
        16;
      container.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
    },
    scrollToSlug(slug: string) {
      const el = root.current?.querySelector(
        `[data-heading="${CSS.escape(slug)}"], [id="${CSS.escape(slug)}"]`,
      );
      el?.scrollIntoView({ block: 'start' });
    },
  }));

  // Post-process: resolve local images, add copy buttons, mark broken links, render diagrams.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let cancelled = false;
    const dir = tree.dirOf(docId);
    for (const img of el.querySelectorAll<HTMLImageElement>('img[src]')) {
      const src = img.getAttribute('src') ?? '';
      if (isExternalHref(src) || src.startsWith('data:') || src.startsWith('blob:')) continue;
      const path = resolvePath(dir, safeDecode(src.split('#')[0]!.split('?')[0]!));
      const target = path !== null ? tree.findByPath(path) : undefined;
      img.removeAttribute('src');
      if (!target) {
        markMissing(img, src);
        continue;
      }
      void imageUrlFor(target.id).then((url) => {
        if (cancelled) return;
        if (url) img.src = url;
        else markMissing(img, src);
      });
    }
    for (const block of el.querySelectorAll<HTMLElement>('.code-block')) {
      if (block.querySelector('.copy-code')) continue;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'copy-code';
      btn.textContent = 'Copy';
      btn.setAttribute('aria-label', 'Copy code');
      block.append(btn);
    }
    for (const a of el.querySelectorAll<HTMLAnchorElement>('a[href]')) {
      const href = a.getAttribute('href') ?? '';
      if (isExternalHref(href) || href.startsWith('#') || a.classList.contains('heading-anchor'))
        continue;
      const target = a.dataset.wiki ? resolveWiki(a.dataset.wiki) : resolveHref(docId, href);
      if (!target) {
        a.classList.add('link-broken');
        a.title = 'This document could not be found';
      }
    }
    void renderMermaidIn(el, theme === 'dark');
    return () => {
      cancelled = true;
    };
  }, [rendered, tree, docId, theme]);

  // Report the first visible source line (for outline highlighting and scroll sync).
  useEffect(() => {
    const el = root.current;
    const container = scrollParent(el);
    if (!el || !container) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const top = container.getBoundingClientRect().top;
        let line = 0;
        for (const node of el.querySelectorAll<HTMLElement>('[data-line]')) {
          if (node.getBoundingClientRect().top - top > 40) break;
          line = Number(node.dataset.line);
        }
        callbacks.current.onVisibleLine?.(line);
      });
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => container.removeEventListener('scroll', onScroll);
  }, [rendered]);

  const onClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target instanceof HTMLInputElement &&
      target.classList.contains('task-list-item-checkbox')
    ) {
      e.preventDefault();
      const li = target.closest<HTMLElement>('[data-line]');
      if (li && callbacks.current.onToggleTask)
        callbacks.current.onToggleTask(Number(li.dataset.line));
      return;
    }
    if (target.classList.contains('copy-code')) {
      const code = target.parentElement?.querySelector('code')?.textContent ?? '';
      void navigator.clipboard?.writeText(code).then(
        () => {
          target.textContent = 'Copied';
          setTimeout(() => (target.textContent = 'Copy'), 1500);
        },
        () => toast({ message: 'Copying is blocked by the browser.', tone: 'error' }),
      );
      return;
    }
    if (target instanceof HTMLImageElement && target.src) {
      setZoom({ src: target.src, alt: target.alt });
      return;
    }
    const a = target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href') ?? '';
    if (href.startsWith('#')) {
      e.preventDefault();
      const slug = safeDecode(href.slice(1));
      root.current
        ?.querySelector(`[data-heading="${CSS.escape(slug)}"], [id="${CSS.escape(slug)}"]`)
        ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      return;
    }
    if (a.dataset.wiki !== undefined) {
      e.preventDefault();
      const id = resolveWiki(a.dataset.wiki);
      if (id) void openEntry(id, a.dataset.fragment && slugify(a.dataset.fragment));
      else
        toast({ message: `"${a.dataset.wiki}" doesn't exist in this workspace.`, tone: 'error' });
      return;
    }
    if (isExternalHref(href)) return; // target=_blank + rel=noopener from the sanitizer
    e.preventDefault();
    const [, fragment] = href.split('#');
    const id = resolveHref(docId, href);
    if (id) void openEntry(id, fragment ? safeDecode(fragment) : undefined);
    else
      toast({ message: `"${safeDecode(href)}" doesn't exist in this workspace.`, tone: 'error' });
  };

  return (
    <>
      <article
        ref={root}
        className={`prose ${className}`}
        onClick={onClick}
        // Sanitized by DOMPurify in renderMarkdown.
        dangerouslySetInnerHTML={{ __html: rendered.html }}
      />
      {zoom &&
        createPortal(
          <div
            className="fixed inset-0 z-[70] flex cursor-zoom-out items-center justify-center bg-[var(--scrim)] p-4 sm:p-10"
            role="dialog"
            aria-modal="true"
            aria-label={zoom.alt || 'Image'}
            onClick={() => setZoom(null)}
            onKeyDown={(e) => e.key === 'Escape' && setZoom(null)}
            tabIndex={-1}
            ref={(el) => el?.focus()}
          >
            <img
              src={zoom.src}
              alt={zoom.alt}
              className="max-h-full max-w-full rounded-md bg-canvas object-contain shadow-3"
            />
          </div>,
          document.body,
        )}
    </>
  );
}

function markMissing(img: HTMLImageElement, src: string) {
  img.classList.add('img-missing');
  img.alt = `Image not found: ${safeDecode(src)}`;
}

function resolveHref(docId: EntryId, href: string): EntryId | undefined {
  const [path = ''] = href.split('#');
  const tree = ws().tree;
  return session().knowledge.resolve(tree, docId, { kind: 'markdown', target: safeDecode(path) });
}

function resolveWiki(target: string): EntryId | undefined {
  return resolveWikiLink(ws().tree, target)?.id;
}

function nearestLineElement(root: HTMLElement | null, line: number): HTMLElement | null {
  if (!root) return null;
  let best: HTMLElement | null = null;
  for (const node of root.querySelectorAll<HTMLElement>('[data-line]')) {
    if (Number(node.dataset.line) <= line) best = node;
    else break;
  }
  return best;
}

function scrollParent(el: HTMLElement | null): HTMLElement | null {
  let cur = el?.parentElement ?? null;
  while (cur) {
    const style = getComputedStyle(cur);
    if (/(auto|scroll)/.test(style.overflowY)) return cur;
    cur = cur.parentElement;
  }
  return null;
}
