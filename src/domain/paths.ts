/** POSIX-style path helpers for workspace-relative paths ("Folder/Sub/file.md"). */

/** Normalizes a path, resolving `.` and `..`. Returns null if it escapes the root. */
export function normalizePath(path: string): string | null {
  const out: string[] = [];
  for (const part of path.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!out.length) return null;
      out.pop();
    } else {
      out.push(part);
    }
  }
  return out.join('/');
}

export function joinPath(...parts: string[]): string {
  return parts.filter(Boolean).join('/');
}

export function dirname(path: string): string {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i);
}

export function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** Resolves `href` relative to directory `fromDir`. Absolute (`/x`) hrefs resolve from root. */
export function resolvePath(fromDir: string, href: string): string | null {
  if (href.startsWith('/')) return normalizePath(href);
  return normalizePath(joinPath(fromDir, href));
}

/** Relative path from directory `fromDir` to `toPath`, e.g. `../b/c.md`. */
export function relativePath(fromDir: string, toPath: string): string {
  const from = fromDir ? fromDir.split('/') : [];
  const to = toPath.split('/');
  let i = 0;
  while (i < from.length && i < to.length - 1 && from[i] === to[i]) i++;
  const ups = from.length - i;
  const rel = [...Array<string>(ups).fill('..'), ...to.slice(i)].join('/');
  return ups === 0 && !rel.startsWith('.') ? `./${rel}` : rel;
}

/** Encodes path segments for use in a Markdown link (spaces etc.). */
export function encodeHrefPath(path: string): string {
  return path
    .split('/')
    .map((seg) => (seg === '.' || seg === '..' ? seg : encodeURIComponent(seg)))
    .join('/');
}

export function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** True for hrefs that point outside the workspace (http, mailto, etc.). */
export function isExternalHref(href: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//');
}
