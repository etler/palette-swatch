import { expect, test } from '@playwright/test';

const colors = ['264653', '2A9D8F', 'E9C46A', 'F4A261', 'E76F51'];

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/#${colors.join('#')}`);
});

test('uses the minimum row count and balances columns when wrapping', async ({ page }) => {
  for (const [width, columns, empty] of [[500, 5, 0], [499, 3, 1], [390, 3, 1], [299, 2, 1], [199, 1, 0], [1440, 5, 0]]) {
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
  const button = page.getByRole('button', { name: 'Add color in empty space' });
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

test('dragging between rows shifts all intervening swatches in linear order', async ({ page }) => {
  const first = page.getByRole('region', { name: 'Color 1', exact: true });
  const fourth = page.getByRole('region', { name: 'Color 4', exact: true });
  await page.mouse.move(65, 100);
  await page.mouse.down();
  await page.mouse.move(195, 522, { steps: 10 });
  await expect(first).toHaveClass(/dragged/);
  await expect.poll(() => fourth.evaluate(element => Math.round(element.getBoundingClientRect().top))).toBe(0);
  expect(await fourth.evaluate(element => Math.round(element.getBoundingClientRect().left))).toBe(260);
  await page.mouse.up();
  await expect(page.locator('.hex-button')).toHaveText(['2A9D8F', 'E9C46A', 'F4A261', 'E76F51', '264653']);
  await page.keyboard.press('Control+z');
  await expect(page.locator('.hex-button')).toHaveText(colors);
});

test('insertion margins and title controls remain usable in 128px rows', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 320 });
  await page.keyboard.press('Control+Space');
  await expect(page.getByRole('main')).toHaveCSS('border-top-width', '32px');
  await expect(page.locator('.swatch').first()).toHaveCSS('height', '128px');
  const clearances = await page.locator('.swatch').first().evaluate(element => {
    const [hex, name] = ['.hex-button', '.name-button'].map(selector => element.querySelector(selector)?.getBoundingClientRect());
    if (!hex || !name) throw new Error('Expected swatch titles');
    const bounds = element.getBoundingClientRect();
    return [hex.top - bounds.top, bounds.bottom - name.bottom];
  });
  for (const clearance of clearances) expect(clearance).toBeGreaterThanOrEqual(0);
  expect(clearances[0]).toBeCloseTo(clearances[1], 1);
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


test('title padding stays the same at minimum height with info hidden', async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const titles = page.locator('.swatch').first().locator('.hex-button, .name-button');
    const padding = await titles.evaluateAll(elements => elements.map(element => getComputedStyle(element).padding));
    await page.setViewportSize({ width, height: 128 });
    await expect.poll(() => titles.evaluateAll(elements => elements.map(element => getComputedStyle(element).padding))).toEqual(padding);
  }
});

test('keyboard focus scrolls additional rows into view', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 440 });
  await page.goto('/#264653#2A9D8F#E9C46A#F4A261#E76F51#DA3C41#ABC123#123ABC');
  await page.getByRole('region', { name: 'Color 1', exact: true }).click({ position: { x: 65, y: 40 } });
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

for (const { count, perRow, empty } of [
  { count: 6, perRow: [3, 3], empty: 0 },
  { count: 9, perRow: [3, 3, 3], empty: 0 },
  { count: 10, perRow: [4, 4, 2], empty: 1 },
  { count: 13, perRow: [4, 4, 4, 1], empty: 1 },
]) {
  test(`${count} colors use rows ${perRow.join('/')} with at most one empty cell`, async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 1000 });
    await page.goto(`/#${Array.from({ length: count }, (_, index) => colors[index % colors.length]).join('#')}`);
    await expect(page.locator('.empty-swatch')).toHaveCount(empty);
    await expect.poll(() => page.locator('.swatch').evaluateAll(elements => {
      const tops = elements.map(element => element.getBoundingClientRect().top);
      return [...new Set(tops)].map(top => tops.filter(value => value === top).length);
    })).toEqual(perRow);
    const widths = await page.locator('.swatch').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().width));
    for (const width of widths) expect(width).toBeGreaterThanOrEqual(100);
    for (const width of widths) expect(width).toBeCloseTo(widths[0], 1);
  });
}

test('the merged bottom-right cell spans the remaining slots and fills one color at a time', async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 900 });
  await page.goto(`/#${[...colors, ...colors].join('#')}`);
  await page.keyboard.press('Control+Space');
  await page.keyboard.press('Control+Space');
  await expect(page.getByRole('main')).toHaveCSS('column-gap', '8px');
  const empty = page.locator('.empty-swatch');
  const last = page.getByRole('region', { name: 'Color 10', exact: true });
  await expect.poll(async () => {
    const bounds = await empty.boundingBox();
    const swatch = await last.boundingBox();
    return bounds && swatch ? Math.round(bounds.width - swatch.width * 2) : null;
  }).toBe(8);
  const bounds = await empty.boundingBox();
  const swatch = await last.boundingBox();
  if (!bounds || !swatch) throw new Error('Expected the merged empty cell');
  expect(bounds.y).toBeCloseTo(swatch.y, 1);
  expect(bounds.x).toBeCloseTo(swatch.x + swatch.width + 8, 1);
  expect(bounds.x + bounds.width).toBeCloseTo(472, 1);
  const button = page.getByRole('button', { name: 'Add color in empty space' });
  const buttonBounds = await button.boundingBox();
  if (!buttonBounds) throw new Error('Expected the centered add button');
  expect(buttonBounds.x + buttonBounds.width / 2).toBeCloseTo(bounds.x + bounds.width / 2, 1);
  await button.click();
  await expect(page.locator('.swatch')).toHaveCount(11);
  await expect(empty).toHaveCount(1);
  await button.click();
  await expect(page.locator('.swatch')).toHaveCount(12);
  await expect(empty).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await expect(page.locator('.swatch')).toHaveCount(10);
  await expect(empty).toHaveCount(1);
});


test('titles move below center as rows grow, while staying clear of delete controls', async ({ page }) => {
  for (const height of [400, 640, 1000]) {
    await page.setViewportSize({ width: 390, height });
    const padding = await page.locator('.swatch').first().evaluate(element => {
      const [hex, name, bottom] = ['.hex-button', '.name-button', '.delete-zone-bottom'].map(selector => element.querySelector(selector)?.getBoundingClientRect());
      if (!hex || !name || !bottom) throw new Error('Expected swatch titles and hover zone');
      const bounds = element.getBoundingClientRect();
      return { above: hex.top - bounds.top, below: bounds.bottom - name.bottom, clearance: bottom.top - name.bottom };
    });
    expect(padding.above).toBeGreaterThan(padding.below);
    expect(padding.clearance).toBeGreaterThanOrEqual(0);
  }
});

test('hidden info releases row height, and enabling it restores room for metadata', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 384 });
  await page.goto('/#111111#222222#333333#444444#555555#666666#777777#888888#999999#AAAAAA#BBBBBB#CCCCCC');
  const swatch = page.locator('.swatch').first();
  const palette = page.getByRole('main');
  await expect(swatch).toHaveCSS('height', '128px');
  expect(await palette.evaluate(element => element.scrollHeight)).toBe(384);
  await page.getByRole('button', { name: 'Color information', exact: true }).click();
  await expect(swatch).toHaveCSS('height', '200px');
  expect(await palette.evaluate(element => element.scrollHeight)).toBe(600);
  await page.getByRole('button', { name: 'Color information', exact: true }).click();
  await expect(swatch).toHaveCSS('height', '128px');
  await page.setViewportSize({ width: 1440, height: 128 });
  await expect(swatch).toHaveCSS('height', '128px');
  await expect.poll(() => swatch.evaluate(element => {
    const title = element.querySelector('.swatch-titles')!.getBoundingClientRect();
    const bounds = element.getBoundingClientRect();
    return Math.min(title.top - bounds.top, bounds.bottom - title.bottom);
  })).toBeGreaterThanOrEqual(0);
});
