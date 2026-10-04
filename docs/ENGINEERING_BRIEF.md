# My Doc — Engineering Brief

## 1. Current repository state

`adan35/my-doc` is empty: one commit with an 8-byte `README.md`. No framework, dependencies, or technical debt. Architecture is designed from scratch.

## 2. Product interpretation

My Doc is a local-first document workspace: a file explorer, a first-class Markdown editor and reader, and fast search in one calm, Notion-like interface. Users import a real folder tree, then browse, edit, link, tag, search, and export it without lock-in. Files stay plain Markdown/text; everything My Doc adds (tags, links) is derived from the files themselves, so exporting loses nothing.

## 3. Recommended stack

| Layer    | Choice                                                                                                                           | Why                                                                                                                                                                                                                         |
| -------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App      | **Vite + React 19 + strict TypeScript** (SPA, installable PWA later)                                                             | Local-first needs no server for the MVP. Next.js would add SSR/server complexity with nothing to render on the server. A static SPA deploys anywhere and can later be wrapped in Tauri/Electron for real filesystem access. |
| Styling  | **Tailwind CSS v4** with CSS-variable design tokens from the Notion design file; Lucide icons                                    | Tokens drive light/dark themes; no component library lock-in. Small hand-built primitives instead of shadcn (fewer deps, same idea).                                                                                        |
| State    | **Zustand**                                                                                                                      | Tiny, no boilerplate, works outside React (services).                                                                                                                                                                       |
| Editor   | **CodeMirror 6**                                                                                                                 | Best Markdown support, virtualized rendering for huge files, multi-cursor, search/replace, mobile-friendly contenteditable. Monaco is heavy and poor on mobile; Tiptap is WYSIWYG and lossy for raw Markdown.               |
| Markdown | **markdown-it** + footnotes, task lists, KaTeX, anchors; **highlight.js**; **Mermaid** (lazy-loaded); **DOMPurify** sanitization | Fast, extensible, battle-tested.                                                                                                                                                                                            |
| Storage  | **IndexedDB** (via `idb`) behind a `WorkspaceStore` interface; in-memory implementation for tests                                | Works offline, handles thousands of docs and binary blobs.                                                                                                                                                                  |
| Search   | **MiniSearch** (client-side full-text, fuzzy + prefix)                                                                           | No service needed; incremental updates; sub-10ms for thousands of docs.                                                                                                                                                     |
| Zip      | **fflate**                                                                                                                       | Small and fast for import/export.                                                                                                                                                                                           |
| Tests    | **Vitest** (+ fake-indexeddb) and **Playwright** (E2E + responsive viewports)                                                    |                                                                                                                                                                                                                             |

## 4. Architecture

```
ui/            React components (no storage knowledge)
app/           Application services + stores: WorkspaceService, EditorSession, SearchService, Import/Export
domain/        Pure types + rules: entries, paths, names, links, tags, outline, templates
storage/       WorkspaceStore interface → IndexedDbStore | MemoryStore (→ FileSystemAccessStore / CloudStore later)
lib/markdown   Rendering + sanitization
```

One app package, layered by folder. No monorepo until a second app (desktop/mobile) exists.

## 5. Storage strategy

- Each workspace is its own IndexedDB database; a small registry lists workspaces.
- Metadata (`entries`) is stored separately from content (`contents`), so the tree loads instantly without reading every file.
- Autosave: debounced (~700 ms) write; on tab hide/unload any pending edit is written synchronously to `localStorage` as a recovery draft and restored on next launch.
- Every write goes through the `WorkspaceStore` interface; the UI never touches IndexedDB.
- Sync later: entries carry stable ids and `updatedAt`, which is what a sync engine needs. No fake sync is shown.

## 6. Data model

- **Entry** `{ id, workspaceId?, parentId, kind: folder|file, name, createdAt, updatedAt, size, mime, favorite, pinned, trashedAt, trashParentId }` — stable id independent of name/path.
- **Content** `{ id, text | blob }`.
- **Version** `{ id, entryId, createdAt, text }` — snapshot on first edit after a 5-minute gap, capped per document.
- **Settings / UI state / recents** — key-value store.
- Tags (`#tag`, front-matter `tags:`) and links (`[x](./a.md)`, `[[Wiki]]`) are **derived** into in-memory indexes, not stored, so files stay the source of truth.

## 7. Search strategy

MiniSearch index over name, path, content, tags; fuzzy + prefix; boosted by name; snippets with highlights; filters (type, folder, tag). Built incrementally on load and updated per save. Indexing sits behind a `SearchIndex` interface so semantic/embedding search can be added as a second ranker.

## 8. Editor strategy

CodeMirror 6 with Markdown language, highlighted code fences, line numbers/wrap toggles, search & replace panel, formatting shortcuts (bold/italic/link/code), image paste/drop saved as attachments in an `assets/` folder next to the document. Modes: Edit / Split / Preview, plus Reading and Focus modes. Non-Markdown text files open in the same editor with their language; binaries show an info panel with download.

## 9. Security strategy

- All Markdown HTML passes through DOMPurify (no scripts, event handlers, iframes, `javascript:` URLs).
- Links: internal links resolved to document ids; external links open with `rel="noopener noreferrer"`.
- Mermaid rendered with `securityLevel: 'strict'`; KaTeX with `trust: false`.
- Names validated (no `/`, `\`, control chars, `..`); import paths normalized to block traversal.
- File size limits on import (per file and total); binary vs text detected by content, not extension alone.
- Strict Content-Security-Policy meta tag.

## 10. MVP scope (this PR)

Workspace shell, explorer (create, rename, move via drag & drop or dialog, duplicate, delete, favorites, sort), Markdown editor + preview + split, outline, autosave + recovery, import (files, folders, zip, drag & drop with conflict handling), export (document as .md/.html, folder or workspace as .zip), trash with restore/undo, global search, quick open (Ctrl/Cmd+P), command palette (Ctrl/Cmd+K), tabs, recents, tags, internal links + backlinks, version history (view + restore), reading & focus modes, templates, home screen, settings, light/dark/system themes, mobile layout.

## 11. Future scope

Real-folder storage via the File System Access API or a desktop shell, cloud storage + sync engine, accounts, sharing/collaboration, PDF export beyond print-to-PDF, graph view, configurable shortcuts, provider-agnostic AI features.

## 12. Major technical risks

- **Browser storage eviction**: mitigated by requesting persistent storage and easy zip export.
- **Large workspaces**: tree virtualization and incremental indexing; measured with a generated 5,000-doc workspace.
- **XSS through Markdown**: sanitized rendering plus security tests.
- **Bundle size** (Mermaid, KaTeX, highlight.js): lazy-loaded chunks.

## 13. Implementation sequence

Foundation (tokens, shell, storage, domain) → MVP (explorer, editor, preview, autosave, import/export, trash) → Productivity (search, palette, tabs, tags, outline) → Knowledge (links, backlinks, versions, reading/focus) → QA (unit, E2E, responsive, security, visual review) → docs.

## 14. Definition of done

Works end to end, persists across reload, handles errors with recovery paths, responsive from 320px to 2560px, keyboard-accessible, sanitized, tested (unit + E2E), polished in both themes, and documented as actually implemented.
