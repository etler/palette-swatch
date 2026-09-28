import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/#264653#2A9D8F#E9C46A#F4A261#E76F51');
  await expect(page.locator('.swatch')).toHaveCount(5);
});

test('keyboard swaps animate both swatches in either direction', async ({ page }) => {
  const selected = page.locator('.swatch').filter({ has: page.getByText('2A9D8F', { exact: true }) });
  await selected.click({ position: { x: 100, y: 200 } });
  for (const key of ['Control+ArrowRight', 'Control+ArrowLeft']) {
    const before = await page.locator('.swatch').evaluateAll(elements => Object.fromEntries(elements.map(element => [element.id, element.getBoundingClientRect().x])));
    await page.keyboard.press(key);
    const moving = await page.locator('.swatch').evaluateAll(elements => elements.filter(element => element.getAnimations().some(animation => animation.playState === 'running')).map(element => element.getAttribute('aria-label')));
    expect(moving.sort()).toEqual(['Color 2', 'Color 3']);
    const during = await page.locator('.swatch').evaluateAll(elements => elements.map(element => ({ id: element.id, x: element.getBoundingClientRect().x })));
    for (const { id, x } of during) expect(Math.abs(x - before[id])).toBeLessThan(288);
    await page.locator('.swatch').evaluateAll(elements => Promise.all(elements.flatMap(element => element.getAnimations().map(animation => animation.finished))));
    expect(await page.locator('.swatch').evaluateAll(elements => elements.map(element => Math.round(element.getBoundingClientRect().x)))).toEqual([0, 288, 576, 864, 1152]);
    await expect(selected).toBeFocused();
  }
  await page.keyboard.press('Control+ArrowRight');
  await page.keyboard.press('Control+ArrowLeft');
  await page.locator('.swatch').evaluateAll(elements => Promise.all(elements.flatMap(element => element.getAnimations().map(animation => animation.finished))));
  await expect(page.locator('.hex-button')).toHaveText(['264653', '2A9D8F', 'E9C46A', 'F4A261', 'E76F51']);
  expect(await selected.evaluate(element => Math.round(element.getBoundingClientRect().x))).toBe(288);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.keyboard.press('Control+ArrowRight');
  expect(await selected.evaluate(element => Math.round(element.getBoundingClientRect().x))).toBe(576);
});

test('move and delete reveal focus on the selected swatch, and arrows continue navigation', async ({ page }) => {
  await page.keyboard.press('Control+ArrowRight');
  await page.keyboard.press('Delete');
  await expect(page.locator('.hex-button')).toHaveText(['264653', '2A9D8F', 'E9C46A', 'F4A261', 'E76F51']);
  const third = page.locator('.swatch').filter({ has: page.getByText('E9C46A', { exact: true }) });
  await third.click({ position: { x: 100, y: 200 } });
  await expect(third).toHaveCSS('outline-style', 'none');
  await page.keyboard.press('Control+ArrowRight');
  await expect(page.locator('.hex-button')).toHaveText(['264653', '2A9D8F', 'F4A261', 'E9C46A', 'E76F51']);
  await expect(third).toBeFocused();
  await expect(third).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Control+ArrowLeft');
  await expect(page.locator('.hex-button')).toHaveText(['264653', '2A9D8F', 'E9C46A', 'F4A261', 'E76F51']);
  await page.keyboard.press('Delete');
  await expect(third).toHaveCount(0);
  await expect(page.locator('.hex-button')).toHaveText(['264653', '2A9D8F', 'F4A261', 'E76F51']);
  await page.keyboard.press('Control+z');
  await expect(page.locator('.hex-button')).toHaveText(['264653', '2A9D8F', 'E9C46A', 'F4A261', 'E76F51']);
  await third.click({ position: { x: 100, y: 200 } });
  await page.keyboard.press('ArrowRight');
  await expect(third).toBeFocused();
  await expect(third).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('region', { name: 'Color 4', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('button', { name: 'Edit Color 4 color F4A261' })).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('button', { name: 'Edit Color 3 color E9C46A' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('button', { name: 'Add name for Color 3' })).toBeFocused();
  await page.keyboard.press('Control+ArrowLeft');
  await expect(page.locator('.hex-button')).toHaveText(['264653', 'E9C46A', '2A9D8F', 'F4A261', 'E76F51']);
  await page.keyboard.press('Delete');
  await expect(third).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(third).toBeVisible();
  for (const [key, parts] of [
    ['ArrowUp', ['swatch', 'name', 'hex', 'swatch', 'name', 'hex', 'swatch']],
    ['ArrowDown', ['hex', 'name', 'swatch', 'hex', 'name', 'swatch']],
  ] as const) {
    await third.click({ position: { x: 100, y: 200 } });
    await expect(third).toHaveCSS('outline-style', 'none');
    for (const part of parts) {
      await page.keyboard.press(key);
      const target = part === 'swatch' ? third : third.locator(`[data-target="${part}"]`);
      await expect(target).toBeFocused();
      await expect(target).toHaveCSS('outline-style', 'solid');
    }
  }
});

test('Tab exposes a visible target and Escape clears it', async ({ page }) => {
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Add color at position 1', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  const first = page.locator('.swatch').filter({ has: page.getByText('264653', { exact: true }) });
  await expect(first).toBeFocused();
  await expect(first).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Escape');
  await expect(first).toHaveCSS('outline-style', 'none');
  await page.keyboard.press('Delete');
  await expect(first).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(page.locator('.swatch')).toHaveCount(5);
  const third = page.locator('.swatch').filter({ has: page.getByText('E9C46A', { exact: true }) });
  await third.click({ position: { x: 100, y: 200 } });
  await page.keyboard.press('Tab');
  await expect(third).toBeFocused();
  await expect(third).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(third.locator('.delete-zone-top button')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Add color at position 4', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('region', { name: 'Color 4', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Add color at position 4', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(third.locator('.delete-zone-top button')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Edit Color 3 color E9C46A' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(third).toBeFocused();
  const name = page.getByRole('button', { name: 'Add name for Color 3' });
  await name.click();
  await page.getByRole('button', { name: 'Cancel rename' }).click();
  await expect(name).toBeFocused();
  await expect(name).toHaveCSS('outline-style', 'none');
  await page.keyboard.press('Tab');
  await expect(third).toBeFocused();
  await expect(third).toHaveCSS('outline-style', 'solid');
});

for (const key of ['Enter', 'Space']) {
  test(`${key} first outlines the mouse selection, then activates it`, async ({ page }) => {
    const swatch = page.getByRole('region', { name: 'Color 3', exact: true });
    await swatch.click({ position: { x: 100, y: 200 } });
    await expect(swatch).toHaveCSS('outline-style', 'none');
    await page.keyboard.press(key);
    await expect(swatch).toBeFocused();
    await expect(swatch).toHaveCSS('outline-style', 'solid');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.keyboard.press(key);
    if (key === 'Space') {
      await expect(page.locator('.swatch')).toHaveCount(6);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.keyboard.press('Control+z');
    } else {
      await expect(page.getByRole('dialog', { name: 'Color picker' })).toBeVisible();
      await page.keyboard.press('Escape');
    }

    const name = page.getByRole('button', { name: 'Add name for Color 3' });
    await name.click();
    await page.getByRole('button', { name: 'Cancel rename' }).click();
    await expect(name).toBeFocused();
    await expect(name).toHaveCSS('outline-style', 'none');
    await page.keyboard.press(key);
    await expect(name).toHaveCSS('outline-style', 'solid');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.keyboard.press(key);
    await expect(page.getByRole('dialog', { name: 'Rename color' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(name).toBeFocused();
    await page.getByRole('button', { name: 'Add color at position 4', exact: true }).focus();
    await page.keyboard.press(key);
    await expect(page.locator('.swatch')).toHaveCount(6);
  });
}

test('name popup cancels with Escape and accepts with Enter', async ({ page }) => {
  const name = page.getByRole('button', { name: 'Add name for Color 1', exact: true });
  await name.click();
  await page.keyboard.type('Cancelled');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(name).toBeFocused();
  await name.click();
  await page.keyboard.type('Ocean');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Rename Ocean' })).toBeFocused();
  await expect(page).toHaveURL(/#264653:Ocean#/);
});

test('picker arrows traverse sliders, typing enters values, and Escape restores the opening color', async ({ page }) => {
  const original = page.getByRole('button', { name: 'Edit Color 1 color 264653' });
  await original.click();
  await page.keyboard.press('ArrowDown');
  const hue = page.getByRole('slider', { name: 'Hue', exact: true });
  await expect(hue).toBeFocused();
  const initialHue = Number(await hue.inputValue());
  await page.keyboard.press('ArrowRight');
  expect(Number(await hue.inputValue())).toBeCloseTo(initialHue + 1, 1);
  const number = page.getByRole('spinbutton', { name: 'Hue value' });
  await page.keyboard.type('120');
  await expect(number).toBeFocused();
  await expect(number).toHaveValue('120');
  await page.keyboard.press('ArrowRight');
  await expect(number).toHaveValue('121');
  await expect(hue).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('slider', { name: 'Saturation', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(original).toBeVisible();
  await expect(page).toHaveURL(/#264653#2A9D8F#/);
});

for (const leaveFocus of ['color plane', 'Tab'] as const) {
  test(`Escape cancels a preview after focus leaves through ${leaveFocus}`, async ({ page }) => {
    const original = page.getByRole('button', { name: 'Edit Color 1 color 264653' });
    await original.click();
    await page.locator('.color-plane').click({ position: { x: 70, y: 20 } });
    await expect(page.locator('.hex-button').first()).not.toHaveText('264653');
    if (leaveFocus === 'Tab') {
      await page.getByRole('button', { name: 'Bookmark swatch', exact: true }).focus();
      await page.keyboard.press('Tab');
    }
    expect(await page.getByRole('dialog').evaluate(element => element.contains(document.activeElement))).toBe(false);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(original).toBeFocused();
    await expect(page).toHaveURL(/#264653#2A9D8F#/);
    await page.keyboard.press('Control+Shift+z');
    await expect(original).toBeVisible();
  });
}

test('Enter accepts the currently typed hex without requiring blur', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit Color 1 color 264653' }).click();
  await page.keyboard.type('ABC123');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit Color 1 color ABC123' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Edit Color 1 color ABC123' })).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Control+z');
  await expect(page.getByRole('button', { name: 'Edit Color 1 color 264653' })).toBeVisible();
});

test('Enter accepts a pending numeric value', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit Color 1 color 264653' }).click();
  await page.getByRole('spinbutton', { name: 'Brightness value' }).fill('0');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit Color 1 color 000000' })).toBeVisible();
});

test('Tab and Shift+Tab follow native controls, including the mode trigger', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit Color 1 color 264653' }).click();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('spinbutton', { name: 'Hue value' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('slider', { name: 'Hue', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('spinbutton', { name: 'Hue value' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('textbox', { name: 'Hex color' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Back to picker' })).toHaveCount(0);
  for (let index = 0; index < 10; index++) await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Change color mode' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'HSB', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'HSL', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'HSB', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('button', { name: 'HSL', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('slider', { name: 'Lightness', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Hex color' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('slider', { name: 'Hue', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

for (const [mode, lastChannel] of [['HSB', 'Brightness'], ['HSL', 'Lightness'], ['RGB', 'Blue'], ['CMYK', 'Black'], ['LAB', 'b']]) {
  test(`${mode} arrows cross between picker and mode endpoints in both directions`, async ({ page }) => {
    await page.getByRole('button', { name: 'Edit Color 1 color 264653' }).click();
    await page.getByRole('button', { name: 'Change color mode' }).click();
    await page.getByRole('button', { name: mode, exact: true }).click();
    const hex = page.getByRole('textbox', { name: 'Hex color' });
    const last = page.getByRole('slider', { name: lastChannel, exact: true });
    await expect(hex).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('button', { name: 'LAB', exact: true })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(hex).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('slider').first()).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(hex).toBeFocused();
    await last.focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('button', { name: 'HSB', exact: true })).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(last).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('slider').nth((await page.getByRole('slider').count()) - 2)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Edit Color 1 color 264653' })).toBeVisible();
  });
}

test('crossing view boundaries preserves pending field edits until accepted or cancelled', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit Color 1 color 264653' }).click();
  await page.getByRole('textbox', { name: 'Hex color' }).fill('ABC123');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('textbox', { name: 'Hex color' })).toHaveValue('ABC123');
  await page.getByRole('spinbutton', { name: 'Brightness value' }).fill('0');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('spinbutton', { name: 'Brightness value' })).toHaveValue('0');
  await expect(page.getByRole('textbox', { name: 'Hex color' })).toHaveValue('000000');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Edit Color 1 color 264653' })).toBeVisible();
});

test('Space opens shades, arrows navigate, Enter accepts and a single undo restores the original', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit Color 1 color 264653' }).click();
  for (const key of ['ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'Space']) await page.keyboard.press(key);
  await expect(page.locator('.shade')).toHaveCount(25);
  await expect(page.locator('.shade[aria-current=true]')).toBeFocused();
  await page.keyboard.press('Home');
  await expect(page.locator('.shade').first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.shade').nth(1)).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Edit Color 1 color 000000' })).toBeVisible();
  await page.keyboard.press('Control+z');
  await expect(page.getByRole('button', { name: 'Edit Color 1 color 264653' })).toBeVisible();
});

test('Escape from shades discards changes made before entering shades', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit Color 1 color 264653' }).click();
  for (const key of ['ArrowDown', 'ArrowRight', 'Space', 'ArrowDown', 'Escape']) await page.keyboard.press(key);
  await expect(page.locator('.shade')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit Color 1 color 264653' })).toBeVisible();
});

test('Control+C copies hex and Control+V inserts external hex to the right of the target', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('region', { name: 'Color 2', exact: true }).click({ position: { x: 100, y: 200 } });
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Control+c');
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('2A9D8F');
  await page.evaluate(() => navigator.clipboard.writeText(' #abc123\n'));
  await page.keyboard.press('Control+v');
  await expect(page.locator('.hex-button')).toHaveText(['264653', '2A9D8F', 'ABC123', 'E9C46A', 'F4A261', 'E76F51']);
  await page.keyboard.press('Control+z');
  await expect(page.locator('.swatch')).toHaveCount(5);
});

test('invalid clipboard text does not change the palette', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.keyboard.press('ArrowRight');
  await page.evaluate(() => navigator.clipboard.writeText('not a color'));
  await page.keyboard.press('Control+v');
  await expect(page.getByRole('status')).toHaveText('Clipboard must contain a hex color.');
  await expect(page.locator('.swatch')).toHaveCount(5);
});

test('copy reveals focus on the selected swatch and arrows continue from it', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(() => navigator.clipboard.writeText('ABCDEF'));
  await page.keyboard.press('Control+c');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('ABCDEF');
  const swatch = page.getByRole('region', { name: 'Color 2', exact: true });
  await swatch.click({ position: { x: 100, y: 200 } });
  await expect(swatch).toHaveCSS('outline-style', 'none');
  await page.keyboard.press('Control+v');
  await expect(page.locator('.swatch')).toHaveCount(5);
  await page.keyboard.press('Control+c');
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('2A9D8F');
  await expect(swatch).toBeFocused();
  await expect(swatch).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Escape');
  await expect(swatch).toHaveCSS('outline-style', 'none');
  await page.evaluate(() => navigator.clipboard.writeText('ABCDEF'));
  await page.keyboard.press('Control+c');
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('2A9D8F');
  await expect(swatch).toBeFocused();
  await expect(swatch).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('region', { name: 'Color 3', exact: true })).toBeFocused();
});

test('native copy reveals focus on the swatch even when a title was selected', async ({ page }) => {
  const swatch = page.getByRole('region', { name: 'Color 3', exact: true });
  await swatch.locator('.name-button').click();
  await page.keyboard.press('Escape');
  await expect(swatch.locator('.name-button')).toBeFocused();
  const copied = await swatch.locator('.name-button').evaluate(element => {
    const clipboardData = new DataTransfer();
    const event = new ClipboardEvent('copy', { clipboardData, bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    return clipboardData.getData('text/plain');
  });
  expect(copied).toBe('E9C46A');
  await expect(swatch).toBeFocused();
  await expect(swatch).toHaveCSS('outline-style', 'solid');
});

test('native paste events accept shorthand hex from an external source', async ({ page }) => {
  await page.keyboard.press('ArrowRight');
  await page.evaluate(() => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', '#abc');
    document.activeElement?.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
  });
  await expect(page.locator('.hex-button')).toHaveText(['264653', 'AABBCC', '2A9D8F', 'E9C46A', 'F4A261', 'E76F51']);
});

test('Alt+Enter enters fullscreen and Escape exits', async ({ page }) => {
  await page.keyboard.press('Alt+Enter');
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
});

test('the picker stays within a shorter desktop viewport while navigating channels', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole('button', { name: 'Edit Color 1 color 264653' }).click();
  const bounds = await page.getByRole('dialog').boundingBox();
  expect(bounds?.y).toBeGreaterThanOrEqual(12);
  for (const _ of Array.from({ length: 3 })) await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('slider', { name: 'Brightness', exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Change color mode' })).toBeInViewport();
});

test('left and right wrap focus at both ends, including titles and a single swatch', async ({ page }) => {
  const first = page.locator('.swatch').filter({ has: page.getByText('264653', { exact: true }) });
  const last = page.getByRole('region', { name: 'Color 5', exact: true });
  await first.click({ position: { x: 100, y: 200 } });
  await page.keyboard.press('ArrowLeft');
  await expect(first).toBeFocused();
  await expect(first).toHaveCSS('outline-style', 'solid');
  for (const part of ['swatch', 'hex', 'name']) {
    if (part !== 'swatch') await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowLeft');
    await expect(part === 'swatch' ? last : last.locator(`[data-target="${part}"]`)).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(part === 'swatch' ? first : first.locator(`[data-target="${part}"]`)).toBeFocused();
  }
  await expect(page).toHaveURL(/#264653#2A9D8F#E9C46A#F4A261#E76F51$/);
  await page.goto('/#264653');
  await page.keyboard.press('Tab');
  for (const key of ['ArrowLeft', 'ArrowRight']) {
    await page.keyboard.press(key);
    await expect(first).toBeFocused();
    await expect(first).toHaveCSS('outline-style', 'solid');
  }
});

for (const [mode, channel, typed] of [['HSB', 'Hue', '120.5'], ['HSL', 'Lightness', '40.5'], ['RGB', 'Red', '120.5'], ['CMYK', 'Black', '40.5'], ['LAB', 'a', '-12.5']]) {
  test(`${mode} supports typing into sliders and modified arrow increments`, async ({ page }) => {
    await page.getByRole('button', { name: 'Edit Color 1 color 264653' }).click();
    await page.getByRole('button', { name: 'Change color mode' }).click();
    await page.getByRole('button', { name: mode, exact: true }).click();
    const slider = page.getByRole('slider', { name: channel, exact: true });
    const number = page.getByRole('spinbutton', { name: `${channel} value`, exact: true });
    await slider.focus();
    await page.keyboard.type(typed);
    await expect(number).toBeFocused();
    await expect(number).toHaveValue(typed);
    await page.keyboard.press('ArrowRight');
    await expect(slider).toBeFocused();
    expect(Number(await slider.inputValue())).toBeCloseTo(Number(typed) + 1, 5);
    for (const [modifier, step] of [['Shift', 10], ['Control', 10], ['Meta', 10], ['Alt', .1], ['Control+Alt', .1]] as const) {
      const before = Number(await slider.inputValue());
      await page.keyboard.press(`${modifier}+ArrowRight`);
      expect(Number(await slider.inputValue())).toBeCloseTo(before + step, 5);
      await page.keyboard.press(`${modifier}+ArrowLeft`);
      expect(Number(await slider.inputValue())).toBeCloseTo(before, 5);
    }
    await page.keyboard.type('0.5');
    await expect(number).toHaveValue('0.5');
    await page.keyboard.press('Alt+ArrowLeft');
    await expect(slider).toBeFocused();
    await expect(number).toHaveValue('0.4');
    await expect(slider).toHaveValue('0.4');
    await number.fill(await slider.getAttribute('max') ?? '');
    await page.keyboard.press('Shift+ArrowRight');
    await expect(slider).toHaveValue(await slider.getAttribute('max') ?? '');
    await number.fill(await slider.getAttribute('min') ?? '');
    await page.keyboard.press('Control+ArrowLeft');
    await expect(slider).toHaveValue(await slider.getAttribute('min') ?? '');
  });
}

test('Tab interleaves add buttons with swatches while arrows skip them', async ({ page }) => {
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Add color at position 1', exact: true })).toBeFocused();
  for (const index of [1, 2, 3, 4, 5]) {
    const swatch = page.getByRole('region', { name: `Color ${index}`, exact: true });
    await page.keyboard.press('Tab');
    await expect(swatch).toBeFocused();
    for (const control of ['.hex-button', '.name-button', '.delete-zone-top button']) {
      await page.keyboard.press('Tab');
      await expect(swatch.locator(control)).toBeFocused();
    }
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: `Add color at position ${index + 1}`, exact: true })).toBeFocused();
  }
  await page.getByRole('region', { name: 'Color 2', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('region', { name: 'Color 3', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('region', { name: 'Color 2', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Add color at position 2', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  const added = page.getByRole('region', { name: 'Color 2', exact: true });
  await expect(added).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Add color at position 2', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(added).toBeFocused();
});

for (const focused of [false, true]) {
  test(`double Space inserts after a ${focused ? 'focused' : 'selected'} swatch and can be undone`, async ({ page }) => {
    const last = page.getByRole('region', { name: 'Color 5', exact: true });
    await last.click({ position: { x: 100, y: 200 } });
    if (focused) await page.keyboard.press('Tab');
    await page.keyboard.press('Space');
    await expect(last).toBeFocused();
    await expect(page.locator('.swatch')).toHaveCount(5);
    await page.keyboard.press('Space');
    await expect(page.locator('.hex-button')).toHaveText(['264653', '2A9D8F', 'E9C46A', 'F4A261', 'E76F51', 'DA3C41']);
    await expect(page.getByRole('region', { name: 'Color 6', exact: true })).toBeFocused();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.keyboard.press('Control+z');
    await expect(page.locator('.swatch')).toHaveCount(5);
    await page.keyboard.press('Control+Shift+z');
    await expect(page.locator('.hex-button').last()).toHaveText('DA3C41');
  });
}

test('Space insertion requires two distinct presses on the same swatch within the double-press interval', async ({ page }) => {
  await page.clock.install();
  await page.getByRole('region', { name: 'Color 2', exact: true }).click({ position: { x: 100, y: 200 } });
  await page.keyboard.down('Space');
  await page.keyboard.down('Space');
  await expect(page.locator('.swatch')).toHaveCount(5);
  await page.keyboard.up('Space');
  await page.clock.runFor(400);
  await page.keyboard.press('Space');
  await expect(page.locator('.swatch')).toHaveCount(5);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  await expect(page.locator('.swatch')).toHaveCount(5);
  await page.keyboard.press('Space');
  await expect(page.locator('.hex-button')).toHaveText(['264653', '2A9D8F', 'E9C46A', 'EFB366', 'F4A261', 'E76F51']);
});

test('Space on focused hex and name titles opens their popups', async ({ page }) => {
  await page.getByRole('region', { name: 'Color 2', exact: true }).click({ position: { x: 100, y: 200 } });
  for (const [arrow, popup] of [['ArrowDown', 'Color picker'], ['ArrowDown', 'Rename color']]) {
    await page.keyboard.press(arrow);
    await page.keyboard.press('Space');
    await expect(page.getByRole('dialog', { name: popup })).toBeVisible();
    await expect(page.locator('.swatch')).toHaveCount(5);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: popup === 'Color picker' ? 'Edit Color 2 color 2A9D8F' : 'Add name for Color 2', exact: true })).toBeFocused();
  }
});

for (const [hash, selected, remaining] of [
  ['111111#222222#333333', 'Color 1', '222222'],
  ['111111#222222#333333', 'Color 2', '333333'],
  ['111111#222222#333333', 'Color 3', '222222'],
  ['111111', 'Color 1', '111111'],
]) {
  test(`deleting mouse-selected ${selected} in ${hash} focuses ${remaining}`, async ({ page }) => {
    await page.goto(`/#${hash}`);
    const swatch = page.getByRole('region', { name: selected, exact: true });
    await swatch.click({ position: { x: 60, y: 180 } });
    await expect(swatch).toHaveCSS('outline-style', 'none');
    await page.keyboard.press('Delete');
    const focused = page.locator('.swatch').filter({ has: page.getByText(remaining, { exact: true }) });
    await expect(focused).toBeFocused();
    await expect(focused).toHaveCSS('outline-style', 'solid');
  });
}
