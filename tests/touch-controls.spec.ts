import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
test.beforeEach(async ({ page }) => {
  await page.goto('/#264653#2A9D8F#E9C46A#F4A261#E76F51');
});

test('tapping the top of a swatch does not expose delete controls', async ({ page }) => {
  await page.touchscreen.tap(195, 24);
  await expect(page.locator('.delete-color:visible')).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Delete swatch' })).toHaveCount(0);
  await expect(page.locator('.swatch')).toHaveCount(5);
});

test('add buttons stay hidden before and after tapping a swatch or the empty cell', async ({ page }) => {
  await expect(page.locator('.add-color:visible')).toHaveCount(0);
  await page.locator('.swatch').nth(1).tap({ position: { x: 40, y: 100 } });
  await expect(page.locator('.add-color:visible')).toHaveCount(0);
  await page.locator('.empty-swatch').tap();
  await expect(page.locator('.swatch')).toHaveCount(5);
  await expect(page.locator('.add-color:visible')).toHaveCount(0);
});

for (const [name, selector, attribute, initial, changed] of [
  ['Menu', '.outline-zone-top-right button', 'aria-expanded', 'false', 'true'],
  ['Information', '.outline-zone-top-left button', 'aria-pressed', 'false', 'true'],
  ['Outline mode', '.outline-zone-bottom-left button', 'data-outline', 'none', 'outer'],
  ['Outline color', '.outline-zone-bottom-right button', 'data-outline', 'none', 'outer'],
] as const) {
  test(`${name} needs a reveal tap before activation`, async ({ page }) => {
    const button = page.locator(selector);
    const state = attribute === 'data-outline' ? page.getByRole('main') : button;
    await expect(button).toHaveCSS('opacity', '0');
    const bounds = await button.boundingBox();
    if (!bounds) throw new Error('Missing corner control');
    await page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await expect(state).toHaveAttribute(attribute, initial);
    await expect(button).toHaveCSS('opacity', '1');
    await button.tap();
    await expect(state).toHaveAttribute(attribute, changed);
  });
}

test('tapping a swatch reveals its controls without changing the palette', async ({ page }) => {
  const swatch = page.locator('.swatch').nth(1);
  await swatch.tap({ position: { x: 40, y: 100 } });
  await expect(page.locator('.swatch')).toHaveCount(5);
  await expect(swatch.locator('.delete-zone-bottom button')).toBeHidden();
  await expect(swatch.locator('.delete-zone-top button')).toBeHidden();
  await expect(page.locator('.add-color:visible')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toHaveCSS('opacity', '1');
});


for (const [index, hex] of [[1, '2A9D8F'], [4, 'E76F51']] as const) {
  test(`double-tapping swatch ${index + 1} opens its color picker`, async ({ page }) => {
    const swatch = page.locator('.swatch').nth(index);
    const bounds = await swatch.boundingBox();
    if (!bounds) throw new Error('Missing swatch');
    const x = bounds.x + bounds.width / 2;
    const y = bounds.y + 100;
    await page.touchscreen.tap(x, y);
    await page.touchscreen.tap(x, y);
    await expect(page.getByRole('dialog', { name: 'Color picker' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Hex color' })).toHaveValue(hex);
    await expect(page.getByRole('dialog').locator('input:focus')).toHaveCount(0);
    await expect(page.locator('.swatch')).toHaveCount(5);
  });
}

test('taps on different swatches and dragging back to the start do not open the picker', async ({ page, context }) => {
  await page.touchscreen.tap(60, 100);
  await page.touchscreen.tap(190, 100);
  await expect(page.locator('.swatch')).toHaveCount(5);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const session = await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 190, y: 100 }] });
  await expect(page.locator('.dragged')).toHaveCount(1);
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 190, y: 180 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 190, y: 100 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.touchscreen.tap(190, 100);
  await expect(page.locator('.swatch')).toHaveCount(5);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('mobile actions append regardless of selection and expose undo and redo availability', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Add swatch', exact: true })).toHaveCount(0);
  await page.locator('.swatch').nth(1).tap({ position: { x: 40, y: 100 } });
  const bounds = await page.getByRole('group', { name: 'Palette actions', exact: true }).boundingBox();
  if (!bounds) throw new Error('Missing mobile actions');
  expect(bounds.x + bounds.width / 2).toBe(195);
  expect(bounds.y + bounds.height).toBe(836);
  const undo = page.getByRole('button', { name: 'Undo', exact: true });
  const add = page.getByRole('button', { name: 'Add swatch', exact: true });
  const redo = page.getByRole('button', { name: 'Redo', exact: true });
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();
  await add.tap();
  await expect(page.locator('.hex-button')).toHaveText(['264653', '2A9D8F', 'E9C46A', 'F4A261', 'E76F51', 'DA3C41']);
  await expect(undo).toBeEnabled();
  await undo.tap();
  await expect(page.locator('.swatch')).toHaveCount(5);
  await expect(undo).toBeDisabled();
  await expect(redo).toBeEnabled();
  await redo.tap();
  await expect(page.locator('.swatch')).toHaveCount(6);
  await expect(redo).toBeDisabled();
  await page.locator('.swatch').last().tap({ position: { x: 40, y: 100 } });
  await undo.tap();
  await expect(page.locator('.swatch')).toHaveCount(5);
  await expect(redo).toBeVisible();
  await expect(redo).toBeEnabled();
  await expect(page.locator('.swatch').last()).toBeFocused();
  await redo.focus();
  await expect(redo).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.swatch')).toHaveCount(6);
});

for (const [selector, popup] of [['.hex-button', 'Color picker'], ['.name-button', 'Color picker']]) {
  test(`tapping ${selector} opens its editor without focusing an input until tapped`, async ({ page }) => {
    await page.locator('.swatch').nth(1).locator(selector).tap();
    const dialog = page.getByRole('dialog', { name: popup });
    await expect(dialog).toBeVisible();
    const input = dialog.getByRole('textbox', { name: selector === '.hex-button' ? 'Hex color' : 'Color Name' });
    await expect(dialog.locator('input:focus')).toHaveCount(0);
    await input.tap();
    await expect(input).toBeFocused();
    await expect(page.locator('.swatch')).toHaveCount(5);
    await expect(page.locator('.dragged')).toHaveCount(0);
  });

  for (const destination of ['reorder', 'trash', 'return', 'cancel']) {
    test(`touch dragging from ${selector}: ${destination}`, async ({ page, context }) => {
      const title = page.locator('.swatch').first().locator(selector);
      const bounds = await title.boundingBox();
      if (!bounds) throw new Error('Missing title');
      const start = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
      const session = await context.newCDPSession(page);
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
      await expect(page.locator('.dragged')).toHaveCount(1);
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + 20, y: start.y }] });
      await expect(page.locator('.dragged')).toHaveCount(1);
      const end = destination === 'trash' ? { x: 195, y: 34 } : { x: 195, y: start.y + 422 };
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [end] });
      if (destination === 'return') await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [start] });
      await session.send('Input.dispatchTouchEvent', { type: destination === 'cancel' ? 'touchCancel' : 'touchEnd', touchPoints: [] });
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.locator('.dragged')).toHaveCount(0);
      const original = ['264653', '2A9D8F', 'E9C46A', 'F4A261', 'E76F51'];
      await expect(page.locator('.hex-button')).toHaveText(destination === 'trash' ? original.slice(1) : destination === 'reorder' ? [...original.slice(1), original[0]] : original);
      if (destination === 'reorder' || destination === 'trash') {
        await page.keyboard.press('Control+z');
        await expect(page.locator('.hex-button')).toHaveText(original);
      }
    });
  }
}

test('single taps on empty space and swatches toggle all edge controls', async ({ page }) => {
  const menu = page.getByRole('button', { name: 'Menu', exact: true });
  const actions = page.getByRole('group', { name: 'Palette actions' });
  await page.locator('.empty-swatch').tap();
  await expect(menu).toHaveCSS('opacity', '1');
  await expect(actions).toBeVisible();
  await page.touchscreen.tap(60, 100);
  await expect(menu).toHaveCSS('opacity', '0');
  await expect(actions).toBeHidden();
  await page.touchscreen.tap(60, 100);
  await expect(menu).toHaveCSS('opacity', '1');
  await menu.tap();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(menu).toHaveCSS('opacity', '1');
  await page.locator('.sidebar-body').tap({ position: { x: 80, y: 10 } });
  await expect(menu).toHaveCSS('opacity', '0');
  await expect(actions).toBeHidden();
});

for (const visible of [false, true]) {
  test(`double-tapping preserves ${visible ? 'shown' : 'hidden'} edge controls`, async ({ page }) => {
    const menu = page.getByRole('button', { name: 'Menu', exact: true });
    if (visible) {
      await page.touchscreen.tap(60, 100);
      await expect(menu).toHaveCSS('opacity', '1');
    }
    await page.touchscreen.tap(190, 100);
    await expect(menu).toHaveCSS('opacity', visible ? '1' : '0');
    await page.touchscreen.tap(190, 100);
    await expect(page.getByRole('dialog', { name: 'Color picker' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await expect(menu).toHaveCSS('opacity', visible ? '1' : '0');
    const actions = page.getByRole('group', { name: 'Palette actions' });
    if (visible) await expect(actions).toBeVisible();
    else await expect(actions).toBeHidden();
  });
}

test('tapping titles and using popup buttons does not reveal edge controls', async ({ page }) => {
  const menu = page.getByRole('button', { name: 'Menu', exact: true });
  for (const [selector, close] of [['.hex-button', 'Cancel color changes'], ['.name-button', 'Cancel color changes']]) {
    await page.locator(selector).nth(1).tap();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: close }).tap();
    await page.waitForTimeout(500);
    await expect(menu).toHaveCSS('opacity', '0');
    await expect(page.getByRole('group', { name: 'Palette actions' })).toBeHidden();
  }
});

test('visible controls stay steady during a tap and its double-tap window', async ({ page, context }) => {
  const menu = page.getByRole('button', { name: 'Menu', exact: true });
  const actions = page.getByRole('group', { name: 'Palette actions' });
  await page.locator('.empty-swatch').tap();
  await expect(menu).toHaveCSS('opacity', '1');
  const session = await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 60, y: 100 }] });
  await page.waitForTimeout(100);
  await expect(page.locator('.dragged')).toHaveCount(0);
  await expect(menu).toHaveCSS('opacity', '1');
  await expect(actions).toBeVisible();
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(100);
  await expect(menu).toHaveCSS('opacity', '1');
  await expect(actions).toBeVisible();
  await expect(menu).toHaveCSS('opacity', '0');
  await expect(actions).toBeHidden();
  await expect(page.locator('.dragged')).toHaveCount(0);
});

test('stationary touch activates dragging after a hold, including from a title', async ({ page, context }) => {
  const title = page.locator('.hex-button').first();
  const bounds = await title.boundingBox();
  if (!bounds) throw new Error('Missing title');
  const session = await context.newCDPSession(page);
  const point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await page.waitForTimeout(150);
  await expect(page.locator('.dragged')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.dragged')).toHaveCount(1);
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('.dragged')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.swatch')).toHaveCount(5);
});

test('releasing with only small movement cancels the pending hold', async ({ page, context }) => {
  const session = await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 65, y: 100 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 70, y: 100 }] });
  await expect(page.locator('.dragged')).toHaveCount(0);
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(500);
  await expect(page.locator('.dragged')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.hex-button')).toHaveText(['264653', '2A9D8F', 'E9C46A', 'F4A261', 'E76F51']);
});

for (const selector of ['.swatch', '.hex-button', '.name-button']) {
  test(`moving 10px from ${selector} starts dragging without waiting for the hold`, async ({ page, context }) => {
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    const bounds = await page.locator(selector).first().boundingBox();
    if (!bounds) throw new Error('Missing touch target');
    const start = { x: bounds.x + bounds.width / 2, y: selector === '.swatch' ? 100 : bounds.y + bounds.height / 2 };
    const session = await context.newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + 5, y: start.y + 5 }] });
    await expect(page.locator('.dragged')).toHaveCount(0);
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + 8, y: start.y + 8 }] });
    await expect(page.locator('.dragged')).toHaveCount(1);
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [start] });
    await expect(page.locator('.dragged')).toHaveCount(1);
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.clock.runFor(500);
    await expect(page.locator('.dragged')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Menu', exact: true })).toHaveCSS('opacity', '0');
    await expect(page.locator('.hex-button')).toHaveText(['264653', '2A9D8F', 'E9C46A', 'F4A261', 'E76F51']);
  });
}
