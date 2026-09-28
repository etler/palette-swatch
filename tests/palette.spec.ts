import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/#264653#2A9D8F#E9C46A#F4A261#E76F51'); });

test('the add margin reveals the button but only the button adds a swatch', async ({ page }) => {
  const button = page.getByRole('button', { name: 'Add color at position 2', exact: true });
  await page.mouse.move(144, 300);
  await expect(button).toHaveCSS('opacity', '0');
  await page.mouse.move(276, 150);
  await expect(button).toHaveCSS('opacity', '1');
  await page.mouse.click(276, 150);
  await expect(page.locator('.swatch')).toHaveCount(5);
  await button.hover();
  await expect(button).toHaveCSS('background-color', 'rgb(237, 237, 237)');
  await button.click();
  await expect(page.locator('.swatch')).toHaveCount(6);
  await expect(page.locator('.hex-button')).toHaveText(['264653', '287271', '2A9D8F', 'E9C46A', 'F4A261', 'E76F51']);
});

for (const { position, hex } of [{ position: 1, hex: '220017' }, { position: 6, hex: 'DA3C41' }]) {
  test(`adding at edge ${position} extrapolates its neighbors and supports undo`, async ({ page }) => {
    await page.getByRole('button', { name: `Add color at position ${position}`, exact: true }).click();
    await expect(page.locator('.hex-button').nth(position - 1)).toHaveText(hex);
    await page.keyboard.press('Control+z');
    await expect(page.locator('.hex-button')).toHaveText(['264653', '2A9D8F', 'E9C46A', 'F4A261', 'E76F51']);
  });
}

for (const { x, destination, order } of [
  { x: 276, destination: 852, order: ['2A9D8F', 'E9C46A', '264653', 'F4A261', 'E76F51'] },
  { x: 300, destination: 588, order: ['264653', 'E9C46A', '2A9D8F', 'F4A261', 'E76F51'] },
]) {
  test(`dragging from the add margin at ${x} moves the swatch under the pointer`, async ({ page }) => {
    await expect(page.locator('.swatch')).toHaveCount(5);
    await page.mouse.move(x, 150);
    await page.mouse.down();
    await page.mouse.move(destination, 160, { steps: 15 });
    await page.mouse.up();
    await expect(page.locator('.hex-button')).toHaveText(order);
    await page.keyboard.press('Control+z');
    await expect(page.locator('.hex-button')).toHaveText(['264653', '2A9D8F', 'E9C46A', 'F4A261', 'E76F51']);
  });
}

for (const edge of ['top', 'bottom']) {
  test(`the ${edge} delete control appears near its edge and supports undo and redo`, async ({ page }) => {
    const swatch = page.getByRole('region', { name: 'Color 1', exact: true });
    const zone = swatch.locator(`.delete-zone-${edge}`);
    const button = zone.getByRole('button', { name: 'Delete Color 1', exact: true });
    await page.mouse.move(144, 300);
    await expect(button).toHaveCSS('opacity', '0');
    for (const x of [4, 284]) {
      await zone.hover({ position: { x, y: edge === 'top' ? 60 : 4 } });
      await expect(button).toHaveCSS('opacity', '1');
      await expect(page.getByRole('button', { name: 'Add color at position 1', exact: true })).toHaveCSS('opacity', '0');
      await expect(page.getByRole('button', { name: 'Add color at position 2', exact: true })).toHaveCSS('opacity', '0');
    }
    await page.mouse.move(276, 150);
    await expect(button).toHaveCSS('opacity', '0');
    await expect(page.getByRole('button', { name: 'Add color at position 2', exact: true })).toHaveCSS('opacity', '1');
    await zone.hover();
    await expect(button).toHaveCSS('opacity', '1');
    await button.click();
    await expect(page.locator('.swatch')).toHaveCount(4);
    await expect(page.getByRole('button', { name: 'Edit Color 1 color 264653' })).toHaveCount(0);
    await page.keyboard.press('Control+z');
    await expect(page.getByRole('button', { name: 'Edit Color 1 color 264653' })).toBeVisible();
    await page.keyboard.press('Control+y');
    await expect(page.locator('.swatch')).toHaveCount(4);
  });
}

test('the last swatch cannot be deleted', async ({ page }) => {
  for (const count of [4, 3, 2, 1]) {
    await page.locator('.delete-zone-top button').last().click();
    await expect(page.locator('.swatch')).toHaveCount(count);
  }
  await expect(page.getByRole('button', { name: /^Delete / })).toHaveCount(0);
  await page.getByRole('region', { name: 'Color 1', exact: true }).focus();
  await page.keyboard.press('Delete');
  await expect(page.locator('.swatch')).toHaveCount(1);
});

test('opening name and hex editors selects their text for immediate replacement', async ({ page }) => {
  await page.getByRole('button', { name: 'Rename Color 1', exact: true }).click();
  await expect(page.getByLabel('Color Name', { exact: true })).toBeFocused();
  await page.keyboard.type('Ocean');
  await expect(page.getByLabel('Color Name', { exact: true })).toHaveValue('Ocean');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Edit Color 1 color 264653' }).click();
  await expect(page.getByRole('textbox', { name: 'Hex color' })).toBeFocused();
  await page.keyboard.type('ABC123');
  await expect(page.getByRole('textbox', { name: 'Hex color' })).toHaveValue('ABC123');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Edit Color 1 color ABC123' })).toBeVisible();
});

test('names persist, additions and renames undo and redo', async ({ page }) => {
  await page.getByRole('button', { name: 'Rename Color 1', exact: true }).click();
  await page.getByLabel('Color Name', { exact: true }).fill('Deep sea');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page).toHaveURL(/#264653:Deep%20sea#2A9D8F/);
  await expect(page.getByRole('button', { name: 'Rename Deep sea' })).toBeVisible();
  await page.keyboard.press('Control+z');
  await expect(page.getByRole('button', { name: 'Rename Color 1', exact: true })).toBeVisible();
  await page.keyboard.press('Control+Shift+z');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Rename Deep sea' })).toBeVisible();
  await page.getByRole('button', { name: 'Add color at position 3', exact: true }).click();
  await expect(page.locator('.swatch')).toHaveCount(6);
  await page.keyboard.press('Control+z');
  await expect(page.locator('.swatch')).toHaveCount(5);
  await page.keyboard.press('Control+y');
  await expect(page.locator('.swatch')).toHaveCount(6);
});

test('shared URLs restore names in a fresh browser context', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:5173/#ABABAB:Meadow#121212#CDCDCD:Sky%20%231%3A%20caf%C3%A9');
  await expect(page.getByRole('button', { name: 'Rename Meadow' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rename Color 2' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rename Sky #1: café' })).toBeVisible();
  await context.close();
});

test('all modes, live color preview, shades, and undo work together', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit Color 1 color 264653' }).click();
  for (const mode of ['RGB', 'CMYK', 'LAB', 'HSL', 'HSB']) {
    await page.getByRole('button', { name: 'Change color mode' }).click();
    await page.locator('.mode-option').filter({ hasText: new RegExp(`^${mode}`) }).click();
    await expect(page.getByRole('slider')).toHaveCount(mode === 'CMYK' ? 4 : 3);
  }
  await page.getByRole('slider', { name: 'Hue', exact: true }).fill('120');
  await expect(page.getByRole('button', { name: 'Edit Color 1 color 264653' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Explore brightness shades' }).click();
  await expect(page.locator('.shade')).toHaveCount(25);
  await expect(page.locator('.shade[aria-current=true]')).toHaveCount(1);
  await page.locator('.shade').first().click();
  await expect(page.getByRole('button', { name: 'Edit Color 1 color 000000' })).toBeVisible();
  await page.keyboard.press('Control+z');
  await expect(page.getByRole('button', { name: 'Edit Color 1 color 000000' })).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(page.getByRole('button', { name: 'Edit Color 1 color 264653' })).toBeVisible();
});

for (const [from, to, colors] of [
  [140, 745, ['2A9D8F', 'E9C46A', '264653', 'F4A261', 'E76F51']],
  [745, 140, ['E9C46A', '264653', '2A9D8F', 'F4A261', 'E76F51']],
] as const) {
  test(`dragging from ${from} to ${to} shifts intervening swatches and commits a single undo step`, async ({ page }) => {
    await page.mouse.move(from, 250);
    await page.mouse.down();
    await page.mouse.move(to, 260, { steps: 15 });
    await page.mouse.up();
    await expect(page.locator('.hex-button')).toHaveText([...colors]);
    await page.keyboard.press('Control+z');
    await expect(page).toHaveURL(/#264653#2A9D8F#E9C46A#F4A261#E76F51$/);
    await page.keyboard.press('Control+Shift+z');
    await expect(page.locator('.hex-button')).toHaveText([...colors]);
  });
}

test('global mode survives closing the picker and hash navigation loads a palette', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit Color 1 color 264653' }).click();
  await page.getByRole('button', { name: 'Change color mode' }).click();
  await page.locator('.mode-option').filter({ hasText: /^LAB/ }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Edit Color 2 color 2A9D8F' }).click();
  await expect(page.getByRole('button', { name: 'Change color mode' })).toHaveText('LAB');
  await page.goto('/#ABC123#123ABC');
  await expect(page.locator('.swatch')).toHaveCount(2);
  await expect(page.locator('.popup')).toHaveCount(0);
});

test('mobile picker fits the screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Edit Color 1 color 264653' }).click();
  const bounds = await page.getByRole('dialog').boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
});

test('clicking another swatch preserves color edits and opens its picker', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit Color 1 color 264653' }).click();
  await page.getByRole('textbox', { name: 'Hex color' }).fill('ABC123');
  await page.getByRole('textbox', { name: 'Hex color' }).press('Enter');
  await page.getByRole('button', { name: 'Edit Color 5 color E76F51' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Hex color' })).toHaveValue('E76F51');
  await expect(page).toHaveURL(/#ABC123#2A9D8F/);
});

test('LAB fields accept typed negative coordinates', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit Color 1 color 264653' }).click();
  await page.getByRole('button', { name: 'Change color mode' }).click();
  await page.locator('.mode-option').filter({ hasText: /^LAB/ }).click();
  const field = page.getByRole('spinbutton', { name: 'a value', exact: true });
  await field.fill('');
  await field.pressSequentially('-42');
  await field.press('ArrowUp');
  await expect(page.getByRole('slider', { name: 'a', exact: true })).toHaveValue('-42');
});

test('renaming a color immediately after editing keeps the new color', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit Color 1 color 264653' }).click();
  await page.getByRole('textbox', { name: 'Hex color' }).fill('ABC123');
  await page.getByRole('textbox', { name: 'Hex color' }).press('Enter');
  await page.getByRole('button', { name: 'Rename Color 1', exact: true }).click();
  await page.getByLabel('Color Name', { exact: true }).fill('Meadow');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.getByRole('button', { name: 'Edit Meadow color ABC123' })).toBeVisible();
});

test('standalone file loads without a server', async ({ page }) => {
  await page.goto(`${new URL('../dist/index.html', import.meta.url).href}#FF0000#00FF00`);
  await expect(page.locator('.swatch')).toHaveCount(2);
  await page.getByRole('button', { name: 'Edit Color 1 color FF0000' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

for (const [name, expected] of [['Color 1', ['264653', '287271', '2A9D8F', 'E9C46A', 'F4A261', 'E76F51']], ['Color 5', ['264653', '2A9D8F', 'E9C46A', 'F4A261', 'E76F51', 'DA3C41']]] as const) {
  test(`double-clicking ${name} inserts to its right using the normal insertion color`, async ({ page }) => {
    await page.getByRole('region', { name, exact: true }).dblclick({ position: { x: 100, y: 200 } });
    await expect(page.locator('.hex-button')).toHaveText([...expected]);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.keyboard.press('Control+z');
    await expect(page.locator('.hex-button')).toHaveText(['264653', '2A9D8F', 'E9C46A', 'F4A261', 'E76F51']);
    await page.keyboard.press('Control+Shift+z');
    await expect(page.locator('.hex-button')).toHaveText([...expected]);
  });
}
