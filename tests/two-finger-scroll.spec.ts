import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 360 }, hasTouch: true, isMobile: true });

for (const finish of ['primary first', 'secondary first', 'cancel'] as const) {
  test(`two fingers scroll without editing the palette (${finish})`, async ({ page, context }) => {
    const colors = Array.from({ length: 30 }, (_, index) => (0x264653 + index * 1000).toString(16).toUpperCase());
    await page.goto(`/#${colors.join('#')}`);
    const palette = page.getByRole('main');
    const originalURL = page.url();
    const session = await context.newCDPSession(page);
    const first = { id: 1, x: 65, y: 278 };
    const second = { id: 2, x: 195, y: 278 };
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first] });
    if (finish === 'secondary first') await expect(page.locator('.dragged')).toHaveCount(1);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first, second] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...first, y: 120 }, { ...second, y: 120 }] });
    await expect.poll(() => palette.evaluate(el => el.scrollTop)).toBe(158);
    await expect(page.locator('.dragged')).toHaveCount(0);
    await expect(page.getByRole('img', { name: 'Delete swatch' })).toHaveCount(0);
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...first, y: 310 }, { ...second, y: 310 }] });
    await expect.poll(() => palette.evaluate(el => el.scrollTop)).toBe(0);
    if (finish !== 'cancel') {
      const remaining = finish === 'primary first' ? second : first;
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ ...remaining, y: 310 }] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...remaining, y: 120 }] });
      await expect(page.locator('.dragged')).toHaveCount(0);
      await expect.poll(() => palette.evaluate(el => el.scrollTop)).toBe(0);
    }
    await session.send('Input.dispatchTouchEvent', { type: finish === 'cancel' ? 'touchCancel' : 'touchEnd', touchPoints: [] });
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.hex-button')).toHaveText(colors);
    expect(page.url()).toBe(originalURL);
    await expect(page.getByRole('button', { name: 'Menu', exact: true })).toHaveCSS('opacity', '0');

    await page.touchscreen.tap(first.x, first.y);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...first, y: 180 }] });
    await expect(page.locator('.dragged')).toHaveCount(1);
    await expect.poll(() => palette.evaluate(el => el.scrollTop)).toBe(0);
    await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await page.touchscreen.tap(first.x, first.y);
    await page.touchscreen.tap(first.x, first.y);
    await expect(page.getByRole('dialog', { name: 'Color picker' })).toBeVisible();
  });
}
