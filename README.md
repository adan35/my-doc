# My Doc

My Doc is a local-first workspace for documents and Markdown. It combines a file explorer, a Markdown editor and reader, full-text search, tabs, tags, links and backlinks, all in one calm interface with light and dark themes. It works on phones, tablets and desktops.

Your documents stay plain Markdown and text. Everything My Doc adds, like tags and links, is read from the files themselves, so exporting a workspace loses nothing.

## Features

**Files and folders**

- File tree with create, rename, move (drag and drop or dialog), duplicate, favorites and sorting by name, date, type or size.
- List and grid folder views. The tree is virtualized, so workspaces with thousands of files stay responsive.
- Trash with restore, permanent delete, and undo for destructive actions.
- Several workspaces, each stored separately.

**Writing and reading**

- A CodeMirror 6 editor with Markdown highlighting, find and replace, a formatting toolbar (headings, lists, checklists, links, tables, equations) and shortcuts, a monospace or sans-serif font, optional line numbers, word wrap and tab size.
- Edit, Split and Preview modes per document, plus Focus mode and Reading mode.
- The preview supports GitHub-style Markdown: tables, task lists (clickable), footnotes, KaTeX math, Mermaid diagrams, syntax-highlighted code with a copy button, and YAML front matter.
- Paste or drop an image into a document to save it in an `assets/` folder next to the document and link it.
- Plain-text and code files open in the same editor. Images show a preview. PDFs and other binary files show an info panel with download, and PDFs and images can open in a new tab.
- An outline of headings, word count and reading time.

**Saving and history**

- Autosave while you type (the delay is configurable), with retries if a write fails.
- Unsaved edits are kept as a recovery draft when the tab closes or crashes, and restored on the next launch.
- Version history: a snapshot is taken after a 5-minute pause in editing (up to 50 per document), with a line diff and one-click restore.

**Finding things**

- Quick open (Ctrl/Cmd + P) with fuzzy matching on names and paths.
- Full-text search (Ctrl/Cmd + Shift + F) with typo tolerance, highlighted plain-text snippets, and filters by type, folder and tag. Opening a result jumps to the first match.
- Command palette (Ctrl/Cmd + K) for every command.
- Home screen with recent documents, favorites and quick actions.

**Knowledge**

- Relative Markdown links (`[x](./notes/a.md)`) and wiki links (`[[Name]]`, `[[Name#Section]]`, `[[Name|Label]]`) open the target document. Broken links are marked. `![[image.png]]` embeds an image found by name.
- Renaming or moving a document rewrites the links that point to it.
- Backlinks, outgoing links and broken links appear in the side panel.
- Tags from `#tag` in text or `tags:` in front matter, with a tag browser. You can add, remove and rename tags across documents.
- Nine document templates (meeting notes, lecture notes, project plan, and others).

**Import and export**

- Import files, whole folders or zip archives, by picker or drag and drop. Folder structure is kept, `.git` and `node_modules` are skipped, and name conflicts can be replaced, skipped or kept as copies.
- Export a document as Markdown, standalone HTML, or PDF (through the browser's print dialog). Export a folder or the whole workspace as a zip.

**Interface**

- Tabs with drag reordering, reopen closed tab, and session restore.
- A layout for each screen size: a bottom navigation bar on phones, a drawer on tablets, and resizable side panels on desktop.
- Light, dark and system themes; comfortable or compact density; adjustable font size and reading width.
- Keyboard shortcuts for everything (open **Keyboard shortcuts** from the command palette for the full list).

## Where your data lives

Everything is stored in your browser's IndexedDB on this device. Nothing is uploaded, and there are no accounts or sync. My Doc asks the browser for persistent storage so data isn't evicted under storage pressure. To back up or move a workspace, export it as a zip from Settings.

## Getting started

Requires Node.js 22 or later.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run preview    # serve the production build
```

Desktop (Windows, macOS, Linux) and mobile (Android, iOS) apps are built from the same code; see [docs/APPS.md](docs/APPS.md).

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for tests and tooling, and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the code is organized.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Development](docs/DEVELOPMENT.md)
- [Desktop and mobile apps](docs/APPS.md)
- [Security](SECURITY.md)
- [Contributing](CONTRIBUTING.md)
- [Engineering brief](docs/ENGINEERING_BRIEF.md): the original plan and decisions

## Not yet built

These are planned and are not in the app today: editing real folders on disk (File System Access API, or a folder-backed store in the desktop app), cloud storage and sync, accounts and sharing, a graph view, configurable shortcuts, and AI features.
