import { expect, test } from '@playwright/test';

const colors = ['264653', '2A9D8F', 'E9C46A', 'F4A261', 'E76F51'];

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/#${colors.join('#')}`);
});

test('wraps below 100px, fills spare cells, and returns to one row when widened', async ({ page }) => {
  for (const [width, columns, empty] of [[500, 5, 0], [499, 4, 3], [390, 3, 1], [299, 2, 1], [199, 1, 0], [1440, 5, 0]]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.locator('.empty-swatch')).toHaveCount(empty);
    await expect.poll(() => page.locator('.swatch').evaluateAll(elements => elements.filter(element => element.getBoundingClientRect().top === elements[0].getBoundingClientRect().top).length)).toBe(columns);
    const widths = await page.locator('.swatch').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().width));
    for (const value of widths) expect(value).toBeGreaterThanOrEqual(100);
    await expect(page.locator('.hex-button')).toHaveText(colors);
  }
});

test('empty cells follow outline color, append an extrapolated color, and support undo', async ({ page }) => {
  const empty = page.locator('.empty-swatch');
  await expect(empty).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await page.keyboard.press('Control+Shift+Space');
  await expect(empty).toHaveCSS('background-color', 'rgb(0, 0, 0)');
  const button = page.getByRole('button', { name: 'Add color in empty space 1' });
  await expect(button).toHaveCSS('color', 'rgb(255, 255, 255)');
  const cellBounds = await empty.boundingBox();
  const buttonBounds = await button.boundingBox();
  if (!cellBounds || !buttonBounds) throw new Error('Expected visible empty cell');
  expect(buttonBounds.x + buttonBounds.width / 2).toBeCloseTo(cellBounds.x + cellBounds.width / 2, 1);
  expect(buttonBounds.y + buttonBounds.height / 2).toBeCloseTo(cellBounds.y + cellBounds.height / 2, 1);
  await button.click();
  await expect(page.locator('.hex-button')).toHaveText([...colors, 'DA3C41']);
  await expect(empty).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(page.locator('.hex-button')).toHaveText(colors);
  await expect(empty).toHaveCount(1);
});

test('keyboard navigation and swaps preserve palette order across row boundaries', async ({ page }) => {
  const third = page.getByRole('region', { name: 'Color 3', exact: true });
  const fourth = page.getByRole('region', { name: 'Color 4', exact: true });
  await third.click({ position: { x: 65, y: 100 } });
  await page.keyboard.press('ArrowRight');
  await expect(third).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(fourth).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(fourth.getByRole('button', { name: /^Edit / })).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(third.getByRole('button', { name: /^Edit / })).toBeFocused();
  await page.keyboard.press('Control+ArrowRight');
  const moving = await page.locator('.swatch').evaluateAll(elements => elements.filter(element => element.getAnimations().some(animation => animation.playState === 'running')).map(element => element.getAttribute('aria-label')));
  expect(moving.sort()).toEqual(['Color 3', 'Color 4']);
  await page.locator('.swatch').evaluateAll(elements => Promise.all(elements.flatMap(element => element.getAnimations().map(animation => animation.finished))));
  await expect(page.locator('.hex-button')).toHaveText(['264653', '2A9D8F', 'F4A261', 'E9C46A', 'E76F51']);
  expect(await third.evaluate(element => element.getBoundingClientRect().top)).toBe(422);
  expect(await fourth.evaluate(element => element.getBoundingClientRect().top)).toBe(0);
  await page.keyboard.press('Control+z');
  await expect(page.locator('.hex-button')).toHaveText(colors);
});

test('dragging between rows swaps the two swatches with an animated preview', async ({ page }) => {
  const first = page.getByRole('region', { name: 'Color 1', exact: true });
  const fifth = page.getByRole('region', { name: 'Color 5', exact: true });
  await page.mouse.move(65, 100);
  await page.mouse.down();
  await page.mouse.move(195, 522, { steps: 10 });
  await expect(first).toHaveClass(/dragged/);
  await expect.poll(() => fifth.evaluate(element => Math.round(element.getBoundingClientRect().top))).toBe(0);
  await page.mouse.up();
  await expect(page.locator('.hex-button')).toHaveText(['E76F51', '2A9D8F', 'E9C46A', 'F4A261', '264653']);
  await page.keyboard.press('Control+z');
  await expect(page.locator('.hex-button')).toHaveText(colors);
});

test('insertion margins and title controls remain usable in short rows', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 440 });
  const margin = page.getByRole('button', { name: 'Add color at position 5', exact: true });
  await margin.click();
  await expect(page.locator('.hex-button')).toHaveText(['264653', '2A9D8F', 'E9C46A', 'F4A261', 'EE8959', 'E76F51']);
  const name = page.getByRole('button', { name: 'Rename Color 5', exact: true });
  await name.click();
  await expect(page.getByRole('textbox', { name: 'Color Name' })).toBeFocused();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Edit Color 5 color E76F51' }).click();
  await expect(page.getByRole('textbox', { name: 'Hex color' })).toBeFocused();
});


test('keyboard focus scrolls additional rows into view', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 440 });
  await page.goto('/#264653#2A9D8F#E9C46A#F4A261#E76F51#DA3C41#ABC123#123ABC');
  await page.getByRole('region', { name: 'Color 1', exact: true }).click({ position: { x: 65, y: 80 } });
  await page.keyboard.press('ArrowRight');
  for (const index of [2, 3, 4, 5, 6, 7, 8]) {
    await page.keyboard.press('ArrowRight');
    const focused = page.getByRole('region', { name: `Color ${index}`, exact: true });
    await expect(focused).toBeFocused();
    await expect(focused).toBeInViewport();
  }
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('region', { name: 'Color 1', exact: true })).toBeFocused();
  await expect(page.getByRole('region', { name: 'Color 1', exact: true })).toBeInViewport();
});
