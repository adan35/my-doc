import markdownIt, { type MarkdownIt, type Token } from 'markdown-it';
import footnote from 'markdown-it-footnote';
import taskLists from 'markdown-it-task-lists';
import katex from '@vscode/markdown-it-katex';
import hljs from 'highlight.js/lib/common';
import { uniqueSlugger } from '@/domain/outline';
import { stripFrontMatter, type FrontMatter } from '@/domain/frontmatter';
import { sanitizeHtml } from './sanitize';

export interface RenderResult {
  html: string;
  frontMatter: FrontMatter | null;
}

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

/** CommonJS plugins may arrive wrapped in `{ default }` depending on the bundler. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const plugin = <T>(mod: T): T => ((mod as any)?.default ?? mod) as T;

function createRenderer(): MarkdownIt {
  const md = markdownIt({
    html: true,
    linkify: true,
    typographer: false,
    breaks: false,
  });
  md.use(plugin(footnote));
  md.use(plugin(taskLists), { enabled: true, label: false });
  md.use(plugin(katex), {
    throwOnError: false,
    trust: false,
    strict: 'ignore',
    maxSize: 50,
    maxExpand: 500,
  } as never);

  // Annotate block tokens with their source line so the preview can scroll-sync,
  // jump to headings and toggle task checkboxes. Line offset is added at render time.
  md.core.ruler.push('source_lines', (state) => {
    const offset = (state.env as { lineOffset?: number }).lineOffset ?? 0;
    for (const token of state.tokens) {
      if (
        token.map &&
        token.nesting >= 0 &&
        (token.level === 0 || token.type === 'list_item_open')
      ) {
        token.attrSet('data-line', String(token.map![0] + offset));
      }
    }
  });

  // Unique heading ids + an anchor link for sharing a section.
  md.core.ruler.push('heading_ids', (state) => {
    const slug = uniqueSlugger();
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i]!;
      if (t.type !== 'heading_open') continue;
      const inline = tokens[i + 1];
      const text =
        inline?.children?.reduce(
          (acc: string, c: Token) =>
            acc + (c.type === 'text' || c.type === 'code_inline' ? c.content : ''),
          '',
        ) ?? '';
      const id = slug(text);
      // data-heading rather than id: ids can clobber DOM globals (e.g. "title"), so the sanitizer strips them.
      t.attrSet('data-heading', id);
      if (inline?.children) {
        const anchor = new state.Token('html_inline', '', 0);
        anchor.content = ` <a class="heading-anchor" href="#${escapeHtml(id)}" aria-label="Link to this section">#</a>`;
        inline.children.push(anchor);
      }
    }
  });

  // [[Target]], [[Target#Section]] and [[Target|Label]] become links the preview resolves by name.
  md.inline.ruler.before('link', 'wikilink', (state, silent) => {
    const src = state.src;
    const start = state.pos;
    if (src.charCodeAt(start) !== 0x5b || src.charCodeAt(start + 1) !== 0x5b) return false;
    const m = /^\[\[([^\]|#\n]+)(#[^\]|\n]*)?(?:\|([^\]\n]*))?\]\]/.exec(src.slice(start));
    if (!m) return false;
    const target = m[1]!.trim();
    if (!target) return false;
    if (!silent) {
      const fragment = m[2]?.slice(1).trim();
      const label = m[3]?.trim() || (fragment ? `${target} › ${fragment}` : target);
      const file = /\.[a-z0-9]+$/i.test(target) ? target : `${target}.md`;
      const open = state.push('link_open', 'a', 1);
      open.attrs = [
        ['href', encodeURI(file) + (fragment ? `#${encodeURIComponent(fragment)}` : '')],
        ['class', 'wiki-link'],
        ['data-wiki', target],
      ];
      if (fragment) open.attrPush(['data-fragment', fragment]);
      state.push('text', '', 0).content = label;
      state.push('link_close', 'a', -1);
    }
    state.pos += m[0].length;
    return true;
  });

  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx]!;
    const lang = String(token.info).trim().split(/\s+/)[0]?.toLowerCase() ?? '';
    const line = token.attrGet('data-line');
    const lineAttr = line ? ` data-line="${escapeHtml(String(line))}"` : '';
    if (lang === 'mermaid') {
      // The diagram source lives in the code element; it's rendered lazily after sanitizing.
      return `<div class="mermaid-block"${lineAttr}><pre><code>${escapeHtml(token.content)}</code></pre></div>`;
    }
    let body: string;
    if (lang && hljs.getLanguage(lang)) {
      try {
        body = hljs.highlight(token.content, { language: lang, ignoreIllegals: true }).value;
      } catch {
        body = escapeHtml(token.content);
      }
    } else {
      body = escapeHtml(token.content);
    }
    const label = lang ? `<span class="code-lang">${escapeHtml(lang)}</span>` : '';
    return `<div class="code-block"${lineAttr}>${label}<pre><code class="hljs${lang ? ` language-${escapeHtml(lang)}` : ''}">${body}</code></pre></div>`;
  };

  // Tables scroll horizontally on narrow screens instead of overflowing the page.
  md.renderer.rules.table_open = (tokens, idx, options, _env, self) =>
    `<div class="table-wrap">${self.renderToken(tokens, idx, options)}`;
  md.renderer.rules.table_close = (tokens, idx, options, _env, self) =>
    `${self.renderToken(tokens, idx, options)}</div>`;

  return md;
}

let renderer: MarkdownIt | null = null;

/** Renders untrusted Markdown to sanitized HTML. */
export function renderMarkdown(src: string): RenderResult {
  renderer ??= createRenderer();
  const { body, data, lineOffset } = stripFrontMatter(src);
  let html: string;
  try {
    html = renderer.render(body, { lineOffset });
  } catch (err) {
    console.error('Markdown render failed', err);
    html = `<pre>${escapeHtml(body)}</pre>`;
  }
  return { html: sanitizeHtml(html), frontMatter: data };
}

/** Renders a plain-text file as a highlighted code block. */
export function renderCode(src: string, lang: string): string {
  let body = escapeHtml(src);
  if (lang && hljs.getLanguage(lang)) {
    try {
      body = hljs.highlight(src, { language: lang, ignoreIllegals: true }).value;
    } catch {
      /* fall back to escaped text */
    }
  }
  return sanitizeHtml(`<pre class="code-file"><code class="hljs">${body}</code></pre>`);
}
