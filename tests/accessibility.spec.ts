import { expect, test } from '@playwright/test';

const colors = '#7F0600#AA1C2E#C04E31#FFB37A#C97233#E48038#F9E7DC';

test.beforeEach(async ({ page }) => {
  await page.goto(`/${colors}`);
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('tab', { name: 'Accessibility', exact: true }).click();
});

test('shows live text ratings and adjacent pairs in palette order', async ({ page }) => {
  const panel = page.getByRole('tabpanel', { name: 'Accessibility' });
  const text = panel.getByRole('region', { name: 'Text Contrast' }).getByRole('listitem');
  const adjacent = panel.getByRole('region', { name: 'Adjacent Contrast' }).getByRole('listitem');
  await expect(text).toHaveCount(7);
  await expect(adjacent).toHaveCount(6);
  await expect(text.first()).toContainText('#7F0600');
  await expect(text.first()).toContainText('AAA');
  await expect(text.nth(2)).toContainText('4.8:1');
  await expect(adjacent.first()).toContainText('Low');
  await page.getByRole('button', { name: 'Edit Color 1 color 7F0600' }).click();
  await page.getByRole('textbox', { name: 'Hex color' }).fill('FFFFFF');
  await page.keyboard.press('Tab');
  await expect(text.first()).toContainText('21.0:1');
  await page.keyboard.press('Escape');
  await expect(text.first()).toContainText('#7F0600');
  await page.getByRole('region', { name: 'Color 1', exact: true }).focus();
  await page.keyboard.press('Control+ArrowRight');
  await expect(text.first()).toContainText('#AA1C2E');
  await page.keyboard.press('Delete');
  await expect(text).toHaveCount(6);
  await expect(adjacent).toHaveCount(5);
  await page.keyboard.press('Control+z');
  await expect(text).toHaveCount(7);
  await expect(adjacent).toHaveCount(6);
});

test('simulation changes the preview without changing source colors or history', async ({ page }) => {
  const swatch = page.getByRole('region', { name: 'Color 1', exact: true });
  const selector = page.getByRole('combobox', { name: 'Vision Simulation' });
  for (const mode of ['Protanopia', 'Deuteranopia', 'Tritanopia', 'Grayscale']) {
    await selector.selectOption(mode);
    await expect(swatch).not.toHaveCSS('background-color', 'rgb(127, 6, 0)');
    await expect(swatch.locator('.hex-button')).toHaveText('7F0600');
    expect(new URL(page.url()).hash).toBe(colors);
  }
  await page.getByRole('button', { name: 'Close menu' }).click();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(selector).toHaveValue('Grayscale');
  await selector.selectOption('Normal');
  await expect(swatch).toHaveCSS('background-color', 'rgb(127, 6, 0)');
  await swatch.focus();
  await page.keyboard.press('Control+z');
  expect(new URL(page.url()).hash).toBe(colors);
});

for (const width of [1440, 390, 320]) {
  test(`accessibility tab navigates and scrolls without overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 600 });
    const tab = page.getByRole('tab', { name: 'Accessibility', exact: true });
    await tab.press('ArrowLeft');
    await expect(page.getByRole('tab', { name: 'Settings', exact: true })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(tab).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Bookmarks', exact: true })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Keyboard shortcuts' })).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(tab).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Close menu' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('combobox', { name: 'Vision Simulation' })).toBeFocused();
    const panel = page.getByRole('tabpanel', { name: 'Accessibility' });
    await panel.getByRole('listitem').last().scrollIntoViewIfNeeded();
    await expect(page.getByRole('tablist')).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    expect(await page.locator('.sidebar-content').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  });
}

test('a single swatch has no adjacent pair', async ({ page }) => {
  await page.goto('/?single#FFFFFF');
  await expect(page.getByRole('region', { name: 'Text Contrast' }).getByRole('listitem')).toHaveCount(1);
  await expect(page.getByRole('region', { name: 'Adjacent Contrast' }).getByRole('listitem')).toHaveCount(0);
});
