import { expect, test } from '@playwright/test';

for (const info of [false, true]) {
  test.describe(info ? 'Touch trash with information' : 'Touch trash', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

    test('tap then drag reorders across rows', async ({ page, context }) => {
      await page.addInitScript(info => localStorage.setItem('palette:info', String(info)), info);
      await page.goto('/#264653#2A9D8F#E9C46A#F4A261#E76F51');
      await page.touchscreen.tap(65, 20);
      const session = await context.newCDPSession(page);
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 65, y: 20 }] });
      await expect(page.locator('.dragged')).toHaveCount(1);
      for (const [x, y] of [[70, 45], [100, 100], [150, 250], [195, 442]]) {
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
        await expect(page.locator('.dragged')).toHaveCount(1);
      }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await expect(page.locator('.hex-button')).toHaveText(['2A9D8F', 'E9C46A', 'F4A261', 'E76F51', '264653']);
      await page.keyboard.press('Control+z');
      await expect(page.locator('.hex-button')).toHaveText(['264653', '2A9D8F', 'E9C46A', 'F4A261', 'E76F51']);
    });

    for (const ending of ['delete', 'leave', 'cancel', 'last'] as const) {
      test(`dragging to trash: ${ending}`, async ({ page, context }) => {
        await page.addInitScript(info => localStorage.setItem('palette:info', String(info)), info);
        await page.goto(ending === 'last' ? '/#E76F51' : '/#264653#2A9D8F#E9C46A#F4A261#E76F51');
        const colors = await page.locator('.hex-button').allTextContents();
        const swatch = await page.locator('.swatch').last().boundingBox();
        if (!swatch) throw new Error('Missing swatch');
        const start = { x: swatch.x + swatch.width / 2, y: swatch.y + 20 };
        const session = await context.newCDPSession(page);
        const move = async (x: number, y: number) => {
          await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
        };
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
        await expect(page.locator('.dragged')).toHaveCount(1);
        const trash = page.getByRole('img', { name: 'Delete swatch' });
        await expect(trash).toBeHidden();
        await move(start.x, start.y + 20);
        if (ending === 'last') await expect(trash).toBeHidden();
        else await expect(trash).toBeVisible();
        const x = 195;
        await move(x, 34);
        if (ending !== 'last') {
          await expect(trash).toHaveAttribute('data-active', 'true');
          await expect(page.locator('.dragged')).toHaveCSS('opacity', '0.5');
          await expect.poll(() => page.locator('.dragged').boundingBox()).toMatchObject({
            width: expect.closeTo(swatch.width * .75, 0),
            height: expect.closeTo(swatch.height * .75, 0),
            x: expect.closeTo(swatch.x + x - start.x + swatch.width * .125, 0),
            y: expect.closeTo(swatch.y + 34 - start.y + swatch.height * .125, 0),
          });
          // Ignoring pointer-events lets this check the actual paint order above the dragged swatch.
          expect(await trash.evaluate(element => {
            (element as HTMLElement).style.pointerEvents = 'auto';
            const bounds = element.getBoundingClientRect();
            const top = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
            (element as HTMLElement).style.pointerEvents = '';
            return top === element || element.contains(top);
          })).toBe(true);
        }
        if (ending === 'leave') {
          await move(start.x, start.y);
          await expect(trash).toHaveAttribute('data-active', 'false');
          await expect(page.locator('.dragged')).toHaveCSS('opacity', '1');
          await expect.poll(() => page.locator('.dragged').boundingBox()).toMatchObject({
            width: expect.closeTo(swatch.width, 0), height: expect.closeTo(swatch.height, 0),
          });
        }
        await session.send('Input.dispatchTouchEvent', { type: ending === 'cancel' ? 'touchCancel' : 'touchEnd', touchPoints: [] });
        await expect(trash).toHaveCount(0);
        await expect(page.locator('.hex-button')).toHaveText(ending === 'delete' ? colors.slice(0, -1) : colors);
        if (ending === 'delete') {
          await page.keyboard.press('Control+z');
          await expect(page.locator('.hex-button')).toHaveText(colors);
          await page.keyboard.press('Control+Shift+z');
          await expect(page.locator('.hex-button')).toHaveText(colors.slice(0, -1));
        }
      });
    }
  });
}

test('mouse dragging across the top center reorders without showing trash or deleting', async ({ page }) => {
  await page.goto('/#264653#2A9D8F#E9C46A#F4A261#E76F51');
  await page.mouse.move(1300, 200);
  await page.mouse.down();
  await page.mouse.move(720, 34, { steps: 8 });
  await expect(page.getByRole('img', { name: 'Delete swatch' })).toHaveCount(0);
  await page.mouse.up();
  await expect(page.locator('.hex-button')).toHaveText(['264653', '2A9D8F', 'E76F51', 'E9C46A', 'F4A261']);
});

for (const fraction of [0.05, 0.5, 0.95]) {
  test(`touch scrolls color information at ${fraction * 100}% width without dragging the swatch`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 500 }, hasTouch: true, isMobile: true });
    await context.addInitScript(() => localStorage.setItem('palette:info', 'true'));
    const page = await context.newPage();
    await page.goto('/#264653#2A9D8F#E9C46A#F4A261#E76F51');
    const info = page.locator('.swatch-info').first();
    const bounds = await info.boundingBox();
    if (!bounds) throw new Error('Missing color information');
    const session = await context.newCDPSession(page);
    const x = bounds.x + bounds.width * fraction;
    const y = bounds.y + bounds.height - 8;
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (const distance of [10, 20, 35, 50]) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - distance }] });
      await expect(page.locator('.dragged')).toHaveCount(0);
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => info.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    await expect(page.getByRole('img', { name: 'Delete swatch' })).toHaveCount(0);
    await expect(page.locator('.hex-button')).toHaveText(['264653', '2A9D8F', 'E9C46A', 'F4A261', 'E76F51']);
    await context.close();
  });
}
