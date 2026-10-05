import { expect, type Page } from '@playwright/test';

export const mod = process.platform === 'darwin' ? 'Meta' : 'Control';

/** Fresh app: first launch seeds the workspace and opens the welcome guide. */
export async function freshApp(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome to My Doc' })).toBeVisible();
}

export async function prompt(page: Page, value: string) {
  const dialog = page.getByRole('dialog');
  const input = dialog.getByRole('textbox');
  await input.fill(value);
  await input.press('Enter');
  await expect(dialog).toBeHidden();
}

export async function typeInEditor(page: Page, text: string) {
  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.press(`${mod}+End`);
  await page.keyboard.type(text);
}

export async function waitSaved(page: Page) {
  await expect(page.getByRole('status').filter({ hasText: /Saved/ }).first()).toBeVisible();
}

export async function newDocInRoot(page: Page, name: string) {
  await page.getByRole('button', { name: 'New document', exact: true }).first().click();
  await expect(page.locator('.cm-content')).toBeVisible();
  await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('button').last().click();
  await prompt(page, name);
}
