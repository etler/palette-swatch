import { expect, test } from '@playwright/test';

test('unnamed swatches reveal Add Name on hover and focus, with an empty name field', async ({ page }) => {
  await page.goto('/#264653#2A9D8F');
  const names = page.locator('.name-placeholder');
  await page.mouse.move(1000, 400);
  await expect(names.first()).toHaveCSS('opacity', '0');
  await expect(names.nth(1)).toHaveCSS('opacity', '0.4');
  await page.locator('.swatch').first().hover();
  await expect(names.first()).toHaveText('Add Name');
  await expect(names.first()).toHaveCSS('opacity', '0.4');
  await page.mouse.move(1000, 400);
  for (const key of ['Tab', 'Tab', 'Tab', 'Tab']) await page.keyboard.press(key);
  await expect(page.getByRole('button', { name: 'Add name for Color 1', exact: true })).toBeFocused();
  await expect(names.first()).toHaveCSS('opacity', '0.4');
  await page.keyboard.press('Enter');
  const field = page.getByRole('textbox', { name: 'Color Name' });
  await expect(field).toHaveValue('');
  await field.fill('Ocean');
  await page.keyboard.press('Enter');
  await page.mouse.move(1000, 400);
  await expect(page.getByRole('button', { name: 'Rename Ocean', exact: true })).toHaveText('Ocean');
  await page.getByRole('button', { name: 'Rename Ocean', exact: true }).click();
  await field.fill('');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/#264653#2A9D8F$/);
  await expect(names.first()).toHaveCSS('opacity', '0.4');
  await page.keyboard.press('Control+z');
  await expect(page.getByRole('button', { name: 'Rename Ocean', exact: true })).toBeVisible();
  await page.keyboard.press('Control+Shift+z');
  await page.reload();
  await expect(page.locator('.name-placeholder')).toHaveCount(2);
});

test('new swatches and unnamed bookmarks stay unnamed across reloads and insertion', async ({ page }) => {
  await page.goto('/#264653');
  await page.getByRole('button', { name: 'Add color at position 2', exact: true }).click();
  await expect(page.locator('.name-placeholder')).toHaveCount(2);
  await page.getByRole('button', { name: 'Edit Color 1 color 264653' }).click();
  await page.getByRole('button', { name: 'Bookmark swatch', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('tab', { name: 'Bookmarks', exact: true }).click();
  await page.reload();
  await expect(page.locator('.bookmark-name')).toHaveText('');
  await page.getByRole('button', { name: 'Add 264653 to palette', exact: true }).click();
  await expect(page.locator('.name-placeholder')).toHaveCount(3);
  await expect(page).toHaveURL(/#264653#264653#264653$/);
});

test('explicit custom names that resemble the old defaults remain visible', async ({ page }) => {
  await page.goto('/#264653:Color%201#2A9D8F');
  await page.mouse.move(1000, 400);
  await expect(page.getByRole('button', { name: 'Rename Color 1', exact: true })).toHaveText('Color 1');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Rename Color 1', exact: true })).toHaveText('Color 1');
});
