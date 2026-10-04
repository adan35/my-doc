import { expect, test } from '@playwright/test';

const WIDTHS = [320, 375, 390, 414, 768, 1024, 1280, 1366, 1440, 1920, 2560];

for (const width of WIDTHS) {
  test(`no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 768 ? 740 : 900 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Welcome to My Doc' })).toBeVisible();
    for (const hash of ['#/', '#/folder', '#/search?q=markdown', '#/trash', '#/settings']) {
      await page.goto(`/${hash}`);
      await page.waitForTimeout(150);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      expect(overflow, `overflow on ${hash}`).toBeLessThanOrEqual(0);
    }
  });
}
