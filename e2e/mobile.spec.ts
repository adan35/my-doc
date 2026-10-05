import { expect, test } from '@playwright/test';

test('phone layout uses bottom navigation and full-screen views', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome to My Doc' })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav).toBeVisible();
  await nav.getByRole('button', { name: 'Files' }).click();
  await page.getByRole('main').getByRole('button', { name: 'Guides', exact: true }).click();
  await page
    .getByRole('main')
    .getByRole('button', { name: 'Markdown guide.md', exact: true })
    .click();
  await expect(page.locator('.cm-content')).toBeVisible();
  await page.getByRole('button', { name: 'Preview' }).click();
  await expect(page.locator('.prose h1')).toHaveText(/Markdown guide/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
