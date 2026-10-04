import { expect, test } from '@playwright/test';
import { strToU8, zipSync } from 'fflate';
import { freshApp } from './helpers';

test('imports a zipped documentation folder preserving structure', async ({ page }) => {
  await freshApp(page);
  const zip = zipSync({
    'README.md': strToU8('# Project\n\nSee [API](./docs/API.md).'),
    'docs/API.md': strToU8('# API\n\nEndpoints live here.'),
    'docs/ARCHITECTURE.md': strToU8('# Architecture'),
    'notes/TODO.md': strToU8('- [ ] ship'),
    'assets/logo.png': new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]),
  });
  await page.getByRole('button', { name: 'Import' }).first().click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Zip archive…' }).click();
  await (
    await chooser
  ).setFiles({ name: 'project.zip', mimeType: 'application/zip', buffer: Buffer.from(zip) });
  await expect(page.getByText(/Imported 5 files, 4 folders/)).toBeVisible();
  await page.getByRole('treeitem', { name: 'project' }).click();
  await page.getByRole('treeitem', { name: 'docs' }).click();
  await page.getByRole('treeitem', { name: 'API.md' }).click();
  await expect(page.locator('.cm-content')).toContainText('Endpoints live here.');

  // Re-importing asks before overwriting anything.
  await page.getByRole('button', { name: 'Import' }).first().click();
  const chooser2 = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Zip archive…' }).click();
  await (
    await chooser2
  ).setFiles({ name: 'project.zip', mimeType: 'application/zip', buffer: Buffer.from(zip) });
  await expect(
    page.getByRole('dialog', { name: 'A file with this name already exists' }),
  ).toBeVisible();
  await page.getByLabel('Do this for all remaining conflicts').check();
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByText(/Imported 0 files/)).toBeVisible();
});

test('binary files show details instead of pretending to be text', async ({ page }) => {
  await freshApp(page);
  await page.getByRole('button', { name: 'Import' }).first().click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Files…' }).click();
  await (
    await chooser
  ).setFiles({
    name: 'data.bin',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from([0, 1, 2, 3, 0, 255]),
  });
  await page.getByRole('treeitem', { name: 'data.bin' }).click();
  await expect(page.getByText("My Doc can store this file but can't edit it.")).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download' })).toBeVisible();
});
