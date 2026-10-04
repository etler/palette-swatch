import { expect, test } from '@playwright/test';

test('custom outline colors apply to borders, gaps, empty cells and ink, and survive reload', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await page.goto('/#264653#2A9D8F#E9C46A#F4A261#E76F51');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByLabel('Minimum swatch width').fill('190');
  await page.getByLabel('Outline color 1', { exact: true }).fill('#123456');
  await page.getByLabel('Outline color 2', { exact: true }).fill('#fedcba');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Close menu' }).click();
  await page.keyboard.press('Control+Space');
  const palette = page.getByRole('main');
  for (const [color, textColor] of [['rgb(18, 52, 86)', 'rgb(255, 255, 255)'], ['rgb(254, 220, 186)', 'rgb(0, 0, 0)']]) {
    await expect(palette).toHaveCSS('border-top-color', color);
    await expect(palette).toHaveCSS('background-color', color);
    await expect(page.locator('.outline-ink')).toHaveCSS('fill', color);
    await expect(page.locator('.empty-swatch')).toHaveCSS('background-color', color);
    await expect(page.getByRole('button', { name: 'Add color in empty space' })).toHaveCSS('color', textColor);
    if (color === 'rgb(18, 52, 86)') await page.keyboard.press('Control+Shift+Space');
  }
  await page.keyboard.press('Control+Space');
  await expect(palette).toHaveAttribute('data-outline', 'swatches');
  await page.reload();
  await expect(palette).toHaveCSS('border-top-color', 'rgb(254, 220, 186)');
  await page.getByRole('button', { name: /^Change outline color/ }).click();
  await expect(palette).toHaveCSS('border-top-color', 'rgb(18, 52, 86)');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(page.getByLabel('Outline color 1', { exact: true })).toHaveValue('#123456');
  await expect(page.getByLabel('Outline color 2', { exact: true })).toHaveValue('#fedcba');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByLabel('Outline color 1', { exact: true })).toHaveValue('#ffffff');
  await expect(page.getByLabel('Outline color 2', { exact: true })).toHaveValue('#000000');
  await expect(palette).toHaveCSS('border-top-color', 'rgb(18, 52, 86)');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(palette).toHaveCSS('border-top-color', 'rgb(255, 255, 255)');
});

test('legacy preferences and invalid colors retain the white and black defaults', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('palette:outline', 'outer:black');
    localStorage.setItem('palette:settings', JSON.stringify({ minimumSwatchWidth: 150, outlineColor1: 'invalid', outlineColor2: null }));
  });
  await page.reload();
  await expect(page.getByRole('main')).toHaveCSS('border-top-color', 'rgb(0, 0, 0)');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(page.getByLabel('Minimum swatch width')).toHaveValue('150');
  await expect(page.getByLabel('Outline color 1', { exact: true })).toHaveValue('#ffffff');
  await expect(page.getByLabel('Outline color 2', { exact: true })).toHaveValue('#000000');
});
