import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/#264653#2A9D8F#E9C46A#F4A261#E76F51');
});

test('settings opens centered, isolates palette controls, and Escape discards edits and restores focus', async ({ page }) => {
  const button = page.getByRole('button', { name: 'Settings', exact: true });
  await expect(button).toHaveCSS('opacity', '0');
  await button.hover();
  await expect(button).toHaveCSS('opacity', '1');
  await button.click();
  const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
  await expect(dialog).toBeVisible();
  await expect.poll(() => dialog.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return { x: Math.round(bounds.x + bounds.width / 2), y: Math.round(bounds.y + bounds.height / 2) };
  })).toEqual({ x: 720, y: 450 });
  const width = page.getByRole('spinbutton', { name: 'Minimum swatch width' });
  await expect(width).toBeFocused();
  await width.fill('250');
  await page.getByRole('button', { name: 'Save', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('main :focus')).toHaveCount(0);
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeFocused();
  await page.keyboard.press('Control+Space');
  await expect(page.locator('main')).toHaveAttribute('data-outline', 'outer');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(button).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(width).toHaveValue('100');
});

test('saving sizes changes wrapping and equal outline gaps and survives reload', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Minimum swatch width' }).fill('190');
  await page.getByRole('spinbutton', { name: 'Window outline width' }).fill('20');
  await page.getByRole('spinbutton', { name: 'Border outline width' }).fill('12');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const palette = page.getByRole('main');
  await expect(palette).toHaveCSS('--rows', '2');
  await expect(page.locator('.empty-swatch')).toHaveCount(1);
  await page.keyboard.press('Control+Space');
  await expect(palette).toHaveCSS('border-top-width', '20px');
  await page.keyboard.press('Control+Space');
  await expect(palette).toHaveCSS('border-top-width', '12px');
  await expect(palette).toHaveCSS('column-gap', '12px');
  await expect(palette).toHaveCSS('row-gap', '12px');
  await expect(palette).toHaveCSS('--rows', '3');
  await page.reload();
  await expect(palette).toHaveCSS('border-top-width', '12px');
  await expect(palette).toHaveCSS('--rows', '3');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Minimum swatch width' })).toHaveValue('190');
  await expect(page.getByRole('spinbutton', { name: 'Window outline width' })).toHaveValue('20');
  await expect(page.getByRole('spinbutton', { name: 'Border outline width' })).toHaveValue('12');
});

test('invalid inputs cannot save and reset restores the responsive defaults', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const open = page.getByRole('button', { name: 'Settings', exact: true });
  await open.click();
  const minimum = page.getByRole('spinbutton', { name: 'Minimum swatch width' });
  const border = page.getByRole('spinbutton', { name: 'Border outline width' });
  await minimum.fill('0');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await minimum.fill('180');
  await border.fill('25');
  await page.keyboard.press('Enter');
  await open.click();
  await page.getByRole('button', { name: 'Reset defaults' }).click();
  await expect(minimum).toHaveValue('100');
  await expect(border).toHaveValue('');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.keyboard.press('Control+Space');
  await expect(page.getByRole('main')).toHaveCSS('border-top-width', '32px');
  await page.keyboard.press('Control+Space');
  await expect(page.getByRole('main')).toHaveCSS('border-top-width', '8px');
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole('main')).toHaveCSS('border-top-width', '16px');
});

test('corrupt settings and blocked storage do not break the palette', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('palette:settings', JSON.stringify({ minimumSwatchWidth: -1, windowOutlineWidth: 'huge', borderOutlineWidth: 4 })));
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Minimum swatch width' })).toHaveValue('100');
  await expect(page.getByRole('spinbutton', { name: 'Window outline width' })).toHaveValue('');
  await expect(page.getByRole('spinbutton', { name: 'Border outline width' })).toHaveValue('4');
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
  });
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Minimum swatch width' }).fill('400');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toHaveCSS('--rows', '2');
});
