import { EditorSelection, type ChangeSpec } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

/** Wraps each selection with `marker` (or unwraps if already wrapped). */
export function toggleWrap(view: EditorView, marker: string, placeholder = 'text'): boolean {
  const { state } = view;
  const tr = state.changeByRange((range) => {
    const before = state.sliceDoc(range.from - marker.length, range.from);
    const after = state.sliceDoc(range.to, range.to + marker.length);
    if (before === marker && after === marker) {
      return {
        changes: [
          { from: range.from - marker.length, to: range.from },
          { from: range.to, to: range.to + marker.length },
        ],
        range: EditorSelection.range(range.from - marker.length, range.to - marker.length),
      };
    }
    const text = state.sliceDoc(range.from, range.to);
    if (text.startsWith(marker) && text.endsWith(marker) && text.length >= marker.length * 2) {
      const inner = text.slice(marker.length, text.length - marker.length);
      return {
        changes: { from: range.from, to: range.to, insert: inner },
        range: EditorSelection.range(range.from, range.from + inner.length),
      };
    }
    const content = text || placeholder;
    return {
      changes: { from: range.from, to: range.to, insert: `${marker}${content}${marker}` },
      range: EditorSelection.range(
        range.from + marker.length,
        range.from + marker.length + content.length,
      ),
    };
  });
  view.dispatch(state.update(tr, { scrollIntoView: true, userEvent: 'input.format' }));
  view.focus();
  return true;
}

export function insertLink(view: EditorView, url = 'https://'): boolean {
  const { state } = view;
  const tr = state.changeByRange((range) => {
    const text = state.sliceDoc(range.from, range.to) || 'link';
    const insert = `[${text}](${url})`;
    const urlStart = range.from + text.length + 3;
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.range(urlStart, urlStart + url.length),
    };
  });
  view.dispatch(state.update(tr, { scrollIntoView: true, userEvent: 'input.format' }));
  view.focus();
  return true;
}

/** Sets or toggles a line prefix (headings, lists, quotes, tasks) on every selected line. */
export function toggleLinePrefix(view: EditorView, prefix: string): boolean {
  const { state } = view;
  const changes: ChangeSpec[] = [];
  const seen = new Set<number>();
  const strip = /^(\s*)(#{1,6}\s+|[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+|>\s?)?/;
  for (const range of state.selection.ranges) {
    for (let pos = range.from; pos <= range.to;) {
      const line = state.doc.lineAt(pos);
      if (!seen.has(line.number)) {
        seen.add(line.number);
        const m = strip.exec(line.text)!;
        const indent = m[1] ?? '';
        const existing = m[2] ?? '';
        const replacement = existing.trim() === prefix.trim() ? '' : prefix;
        changes.push({
          from: line.from + indent.length,
          to: line.from + indent.length + existing.length,
          insert: replacement,
        });
      }
      pos = line.to + 1;
    }
  }
  view.dispatch({ changes, userEvent: 'input.format', scrollIntoView: true });
  view.focus();
  return true;
}

export function insertText(view: EditorView, text: string): void {
  const { from, to } = view.state.selection.main;
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length },
    userEvent: 'input',
    scrollIntoView: true,
  });
  view.focus();
}

/** Inserts a fenced code block (or wraps the selection in one). */
export function insertCodeBlock(view: EditorView): boolean {
  const { state } = view;
  const { from, to } = state.selection.main;
  const text = state.sliceDoc(from, to);
  const line = state.doc.lineAt(from);
  const lead = from === line.from ? '' : '\n';
  const insert = `${lead}\`\`\`\n${text}\n\`\`\`\n`;
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + lead.length + 3 },
    userEvent: 'input.format',
    scrollIntoView: true,
  });
  view.focus();
  return true;
}

export function insertTable(view: EditorView): boolean {
  const line = view.state.doc.lineAt(view.state.selection.main.from);
  const lead = line.text.trim() ? '\n\n' : '';
  insertText(view, `${lead}| Column | Column |\n| --- | --- |\n|  |  |\n`);
  return true;
}
