import { expect, test } from '@playwright/test';
import { freshApp, mod, newDocInRoot, typeInEditor, waitSaved } from './helpers';

// CodeMirror ignores keys for a moment after the menu opens, so a user can't accept it by accident.
const settle = (page: import('@playwright/test').Page) => page.waitForTimeout(200);

const editor = (page: import('@playwright/test').Page) => page.locator('.cm-content');

test('slash menu filters by typing and inserts blocks', async ({ page }) => {
  await freshApp(page);
  await newDocInRoot(page, 'Slash.md');
  await typeInEditor(page, '\n/hea');
  const menu = page.locator('.cm-tooltip-autocomplete');
  await expect(menu.getByRole('option').first()).toContainText('Heading 1');
  await settle(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Plan');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/check');
  await expect(menu.getByRole('option').first()).toContainText('Checklist');
  await settle(page);
  await page.keyboard.press('Enter');
  await page.keyboard.type('Ship it');
  await waitSaved(page);
  await expect(editor(page)).toContainText('## Plan');
  await expect(editor(page)).toContainText('- [ ] Ship it');
  // A slash inside a sentence isn't a command.
  await page.keyboard.press('Enter');
  await page.keyboard.type('and/or ');
  await expect(menu).toBeHidden();
});

test('visual table editor inserts and edits valid Markdown tables', async ({ page }) => {
  await freshApp(page);
  await newDocInRoot(page, 'Tables.md');
  await typeInEditor(page, '\n/table');
  await expect(page.locator('.cm-tooltip-autocomplete [role=option]').first()).toContainText(
    'Table',
  );
  await settle(page);
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Insert table' });
  await dialog.getByLabel('Column 1 heading').fill('Name');
  await dialog.getByLabel('Row 1, column 1').fill('Ada | Lovelace');
  await dialog.getByRole('button', { name: 'Column 2 options' }).click();
  await page.getByRole('menuitem', { name: 'Align right' }).click();
  await dialog.getByRole('button', { name: 'Insert table' }).click();
  await expect(editor(page)).toContainText('| Name');
  await expect(editor(page)).toContainText('Ada \\| Lovelace');
  await expect(editor(page)).toContainText('---: |');

  // Edit it again from the command palette with the cursor inside the table.
  await page.locator('.cm-line', { hasText: 'Ada' }).click();
  await page.keyboard.press(`${mod}+k`);
  await page.keyboard.type('edit table');
  await page.keyboard.press('Enter');
  const edit = page.getByRole('dialog', { name: 'Edit table' });
  await expect(edit.getByLabel('Row 1, column 1')).toHaveValue('Ada \\| Lovelace');
  await edit.getByRole('button', { name: 'Add column' }).click();
  await edit.getByLabel('Column 4 heading').fill('Year');
  await edit.getByRole('button', { name: 'Save table' }).click();
  await expect(editor(page)).toContainText('Year');
  await waitSaved(page);
  await page.getByRole('button', { name: 'Preview' }).click();
  await expect(page.locator('.prose table th')).toHaveCount(4);
  await expect(page.locator('.prose table td').first()).toHaveText('Ada | Lovelace');
});
