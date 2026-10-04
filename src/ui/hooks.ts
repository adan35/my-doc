import { useEffect, useState, useSyncExternalStore } from 'react';
import { useApp } from '@/app/app-store';
import { useSettings } from '@/app/settings-store';

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = matchMedia(query);
      mql.addEventListener('change', cb);
      return () => mql.removeEventListener('change', cb);
    },
    () => matchMedia(query).matches,
    () => false,
  );
}

/** Layout tiers: phone gets its own navigation model, not a shrunken desktop. */
export function useLayout() {
  const phone = useMediaQuery('(max-width: 767px)');
  const tablet = useMediaQuery('(min-width: 768px) and (max-width: 1099px)');
  const wide = useMediaQuery('(min-width: 1280px)');
  return { phone, tablet, desktop: !phone && !tablet, wide };
}

/** Re-renders when the workspace tree changes; returns the tree. */
export function useTree() {
  useApp((s) => s.treeVersion);
  const session = useApp((s) => s.session);
  return session?.workspace.tree ?? null;
}

/** Re-renders when indexes change. */
export function useIndexVersion() {
  return useApp((s) => s.indexVersion);
}

export function useResolvedTheme(): 'light' | 'dark' {
  const theme = useSettings((s) => s.theme);
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  return theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
}

export function useDebounced<T>(value: T, delay: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const modKey = isMac ? '⌘' : 'Ctrl';

export function formatShortcut(s: string): string {
  return s
    .replace(/Mod/g, modKey)
    .replace(/Shift/g, isMac ? '⇧' : 'Shift')
    .replace(/Alt/g, isMac ? '⌥' : 'Alt')
    .replace(/\+/g, isMac ? '' : '+');
}

const rtf =
  typeof Intl !== 'undefined' ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }) : null;

export function relativeTime(ts: number, now = Date.now()): string {
  const diff = (ts - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return 'just now';
  if (!rtf) return new Date(ts).toLocaleString();
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), 'day');
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: new Date(ts).getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric',
  });
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => {
      addEventListener('online', cb);
      addEventListener('offline', cb);
      return () => {
        removeEventListener('online', cb);
        removeEventListener('offline', cb);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}
