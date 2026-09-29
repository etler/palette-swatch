import { expect, test } from '@playwright/test';

test('fullscreen touch button is hidden on desktop', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Enter fullscreen', includeHidden: true })).toBeHidden();
});

test.describe('mobile fullscreen control', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test.beforeEach(async ({ page }) => {
    await page.goto('/#264653#2A9D8F#E9C46A#F4A261#E76F51');
  });

  test('a reveal tap does not enter fullscreen; subsequent taps toggle it and browser exit updates the button', async ({ page }) => {
    const enter = page.getByRole('button', { name: 'Enter fullscreen' });
    await expect(enter).toHaveCSS('opacity', '0');
    await page.touchscreen.tap(195, 26);
    await expect(enter).toHaveCSS('opacity', '1');
    expect(await page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
    await enter.tap();
    await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
    const exit = page.getByRole('button', { name: 'Exit fullscreen' });
    await expect(exit).toHaveCSS('opacity', '1');
    await exit.tap();
    await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
    await enter.tap();
    await expect(exit).toBeVisible();
    await page.evaluate(() => document.exitFullscreen());
    await expect(enter).toBeVisible();
  });

  test('stays centered over swatches and hides with other controls during drag and editing', async ({ page, context }) => {
    await page.touchscreen.tap(65, 90);
    const button = page.getByRole('button', { name: 'Enter fullscreen' });
    await expect(button).toHaveCSS('opacity', '1');
    for (const open of [false, true]) {
      if (open) {
        await page.getByRole('button', { name: 'Menu', exact: true }).tap();
        await expect.poll(() => page.locator('.settings-panel').evaluate(el => el.getBoundingClientRect().width)).toBe(220);
      }
      const area = await page.locator('.palette-workspace').boundingBox();
      const bounds = await button.boundingBox();
      expect(bounds).toMatchObject({ width: 36, height: 36, y: 8 });
      expect(bounds!.x + bounds!.width / 2).toBe(area!.x + area!.width / 2);
    }
    const session = await context.newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 50, y: 20 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 50, y: 80 }] });
    await expect(page.locator('.dragged')).toHaveCount(1);
    await expect(button).toHaveCount(0);
    await expect(page.getByRole('img', { name: 'Delete swatch' })).toBeVisible();
    await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await expect(button).toHaveCSS('opacity', '1');
    await page.locator('.hex-button').first().tap();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(button).toHaveCount(0);
  });
});
