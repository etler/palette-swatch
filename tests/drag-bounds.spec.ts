import { expect, test } from '@playwright/test';

for (const width of [1440, 390]) {
  for (const mode of ['none', 'outer', 'swatches'] as const) {
    test(`dragging stays inside ${mode} bounds at ${width}px and returns to its origin`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/#264653#2A9D8F#E9C46A#F4A261#E76F51');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      if (mode !== 'none') await page.keyboard.press('Control+Space');
      if (mode === 'swatches') await page.keyboard.press('Control+Space');
      await expect(page.getByRole('main')).toHaveAttribute('data-outline', mode);
      const border = { none: 0, outer: width === 1440 ? 48 : 32, swatches: width === 1440 ? 16 : 8 }[mode];
      await expect(page.getByRole('main')).toHaveCSS('border-top-width', `${border}px`);
      const swatch = page.getByRole('region', { name: 'Color 2', exact: true });
      const start = await swatch.boundingBox();
      if (!start) throw new Error('Expected a visible swatch');
      const bounds = await page.getByRole('main').evaluate(element => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left + element.clientLeft, top: rect.top + element.clientTop,
          right: rect.left + element.clientLeft + element.clientWidth, bottom: rect.top + element.clientTop + element.clientHeight };
      });
      const x = start.x + start.width / 2;
      const y = start.y + start.height / 4;
      await page.mouse.move(x, y);
      await page.mouse.down();
      for (const [pointerX, pointerY, left, top] of [
        [-100, -100, bounds.left, bounds.top],
        [width + 100, 944, bounds.right - start.width, bounds.bottom - start.height],
        [x, y, start.x, start.y],
      ]) {
        await page.mouse.move(pointerX, pointerY);
        await expect.poll(() => swatch.boundingBox()).toMatchObject({ x: expect.closeTo(left, 0), y: expect.closeTo(top, 0) });
      }
      await page.mouse.up();
      await expect(page.locator('.hex-button')).toHaveText(['264653', '2A9D8F', 'E9C46A', 'F4A261', 'E76F51']);
    });
  }
}

test('scrolled palettes constrain dragging to the visible viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 340 });
  await page.goto('/#111111#222222#333333#444444#555555#666666#777777#888888#999999#AAAAAA#BBBBBB#CCCCCC');
  await page.getByRole('main').evaluate(element => { element.scrollTop = 120; });
  const swatch = page.getByRole('region', { name: 'Color 4', exact: true });
  const start = await swatch.boundingBox();
  if (!start) throw new Error('Expected a visible swatch');
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 4);
  await page.mouse.down();
  await page.mouse.move(65, -100);
  await expect.poll(() => swatch.evaluate(element => Math.round(element.getBoundingClientRect().top))).toBe(0);
  await page.mouse.move(65, 600);
  await expect.poll(() => swatch.evaluate(element => Math.round(element.getBoundingClientRect().bottom))).toBe(340);
  await page.mouse.up();
});

test.describe('touch dragging', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('follows the finger past every edge and returns to its origin', async ({ page, context }) => {
    await page.goto('/#264653#2A9D8F#E9C46A#F4A261#E76F51');
    const swatch = page.locator('.swatch').nth(1);
    const bounds = await swatch.boundingBox();
    if (!bounds) throw new Error('Missing swatch');
    const start = { x: bounds.x + bounds.width / 2, y: bounds.y + 100 };
    const session = await context.newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
    await expect(page.locator('.dragged')).toHaveCount(1);
    for (const point of [{ x: 2, y: 2 }, { x: 388, y: 842 }, start]) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
      await expect.poll(() => swatch.boundingBox()).toMatchObject({
        x: expect.closeTo(bounds.x + point.x - start.x, 0),
        y: expect.closeTo(bounds.y + point.y - start.y, 0),
      });
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('.hex-button')).toHaveText(['264653', '2A9D8F', 'E9C46A', 'F4A261', 'E76F51']);
  });
});
