import { describe, expect, it } from 'vitest';
import { MemoryProvider } from '@/storage/memory';
import { Workspace } from './workspace';
import { WorkspaceSession } from './session';
import { importItems } from './importer';

/**
 * Large-workspace budget check. Run with `PERF=1 npx vitest run src/app/perf.test.ts`.
 * Skipped by default so the regular suite stays fast.
 */
describe.skipIf(!import.meta.env.PERF)('performance (5,000 documents)', () => {
  it('imports, indexes, searches and renames within budget', async () => {
    const provider = new MemoryProvider();
    const store = await provider.open((await provider.create('Perf')).id);
    const ws = await Workspace.open(store);
    const session = new WorkspaceSession(ws);
    await session.ready;

    const words = 'alpha beta gamma delta project roadmap meeting notes design release'.split(' ');
    const items = Array.from({ length: 5000 }, (_, i) => {
      const body = Array.from({ length: 200 }, (_, j) => words[(i * 7 + j) % words.length]).join(
        ' ',
      );
      const text = `# Doc ${i}\n\n#topic${i % 50} links to [[Doc ${(i + 1) % 5000}]]\n\n${body}\n`;
      return { path: `big/folder${i % 100}/Doc ${i}.md`, file: new File([text], `Doc ${i}.md`) };
    });

    let t = performance.now();
    const res = await importItems(ws, null, items, async () => ({
      action: 'keep-both',
      applyToAll: true,
    }));
    const importMs = performance.now() - t;
    expect(res.files).toBe(5000);
    console.log({ importMs });

    t = performance.now();
    const reopened = await Workspace.open(store);
    const s2 = new WorkspaceSession(reopened);
    await s2.ready;
    const openMs = performance.now() - t;

    t = performance.now();
    const hits = s2.search.search('roadmap meeting', reopened.tree);
    const searchMs = performance.now() - t;
    expect(hits.length).toBeGreaterThan(0);

    t = performance.now();
    const folder = reopened.tree.findByPath('big/folder1')!;
    await reopened.rename(folder.id, 'renamed');
    const renameMs = performance.now() - t;

    console.log({ importMs, openMs, searchMs, renameMs });
    expect(importMs).toBeLessThan(15_000);
    expect(openMs).toBeLessThan(5000);
    expect(renameMs).toBeLessThan(2000);
    expect(searchMs).toBeLessThan(200);
  }, 300_000);
});
