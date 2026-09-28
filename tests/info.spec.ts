import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/#264653#2A9D8F#E9C46A#F4A261#E76F51');
});

test('the info toggle places metadata above the titles and restores the original layout when hidden', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  const toggle = page.getByRole('button', { name: 'Color information', exact: true });
  const title = page.getByRole('button', { name: 'Edit Color 1 color 264653' });
  const originalTop = await title.evaluate(element => element.getBoundingClientRect().top);
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.swatch-info')).toHaveCount(5);
  for (const swatch of await page.locator('.swatch').all()) {
    const infoBottom = await swatch.locator('.swatch-info').evaluate(element => element.getBoundingClientRect().bottom);
    const hexTop = await swatch.locator('.hex-button').evaluate(element => element.getBoundingClientRect().top);
    expect(infoBottom).toBeLessThanOrEqual(hexTop);
    const lastInfoBottom = await swatch.locator('.swatch-info dd').last().evaluate(element => element.getBoundingClientRect().bottom);
    expect(hexTop - lastInfoBottom).toBeLessThan(30);
  }
  const info = page.getByRole('region', { name: 'Color 1 color information', exact: true });
  await expect(info).toContainText('38 70 83');
  await expect(info).toContainText('White text · WCAG 2.2');
  await expect(info.locator('button, input, a')).toHaveCount(0);
  await toggle.press('Space');
  await expect(page.locator('.swatch-info')).toHaveCount(0);
  expect(await title.evaluate(element => element.getBoundingClientRect().top)).toBeCloseTo(originalTop, 1);
  await expect(page).toHaveURL(/#264653#2A9D8F#E9C46A#F4A261#E76F51$/);
});

test('metadata follows live color edits, cancellation, undo, and new swatches', async ({ page }) => {
  await page.getByRole('button', { name: 'Color information', exact: true }).click();
  const info = page.getByRole('region', { name: 'Color 1 color information', exact: true });
  await page.getByRole('button', { name: 'Edit Color 1 color 264653' }).click();
  await page.getByRole('textbox', { name: 'Hex color' }).fill('FF0000');
  await page.getByRole('textbox', { name: 'Hex color' }).press('Tab');
  await expect(info).toContainText('255 0 0');
  await page.keyboard.press('Escape');
  await expect(info).toContainText('38 70 83');
  await page.getByRole('button', { name: 'Edit Color 1 color 264653' }).click();
  await page.getByRole('textbox', { name: 'Hex color' }).fill('FFFFFF');
  await page.keyboard.press('Enter');
  await expect(info).toContainText('255 255 255');
  await page.keyboard.press('Control+z');
  await expect(info).toContainText('38 70 83');
  await page.getByRole('button', { name: 'Add color at position 3', exact: true }).click();
  await expect(page.locator('.swatch-info')).toHaveCount(6);
  await page.getByRole('region', { name: 'Color 2', exact: true }).focus();
  await page.keyboard.press('Control+ArrowRight');
  await expect(page.getByRole('region', { name: 'Color 2 color information', exact: true })).toContainText('42 157 143');
});

test('metadata scrolls independently with wheel and keyboard and text gestures do not edit swatches', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 400 });
  await page.getByRole('button', { name: 'Color information', exact: true }).click();
  const info = page.getByRole('region', { name: 'Color 1 color information', exact: true });
  await info.hover();
  await page.mouse.wheel(0, 100);
  await expect.poll(() => info.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  expect(await page.locator('.swatch-info').nth(1).evaluate(element => element.scrollTop)).toBe(0);
  await info.focus();
  await page.keyboard.press('End');
  await expect.poll(() => info.evaluate(element => Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop))).toBeLessThanOrEqual(1);
  await page.keyboard.press('Home');
  await expect.poll(() => info.evaluate(element => element.scrollTop)).toBe(0);
  await info.locator('dd').first().dblclick();
  expect(await page.evaluate(() => getSelection()?.toString())).not.toBe('');
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Delete');
  await expect(page.locator('.swatch')).toHaveCount(5);
  await expect(page.getByRole('main')).not.toHaveClass(/is-dragging/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/#264653#2A9D8F#E9C46A#F4A261#E76F51$/);
});

test('minimum-height wrapped swatches keep both titles and a scrollable metadata area', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 480 });
  await page.goto('/#111111#222222#333333#444444#555555#666666#777777#888888#999999#AAAAAA#BBBBBB#CCCCCC');
  await page.getByRole('button', { name: 'Color information', exact: true }).click();
  for (const swatch of await page.locator('.swatch').all()) {
    const geometry = await swatch.evaluate(element => {
      const info = element.querySelector<HTMLElement>('.swatch-info');
      const name = element.querySelector('.hex-button');
      if (!info || !name) throw new Error('Expected a title and metadata in every swatch');
      const title = name.getBoundingClientRect();
      const bounds = info.getBoundingClientRect();
      return { height: bounds.height, titleTop: title.top, top: bounds.top, bottom: bounds.bottom, swatchBottom: element.getBoundingClientRect().bottom, overflow: info.scrollHeight > info.clientHeight, width: info.scrollWidth, clientWidth: info.clientWidth };
    });
    expect(geometry.height).toBeGreaterThan(30);
    expect(geometry.bottom).toBeLessThanOrEqual(geometry.titleTop);
    expect(geometry.bottom).toBeLessThanOrEqual(geometry.swatchBottom);
    expect(geometry.overflow).toBe(true);
    expect(geometry.width).toBe(geometry.clientWidth);
  }
});

test('the info toggle remembers both states across reloads and different palettes', async ({ page }) => {
  const toggle = page.getByRole('button', { name: 'Color information', exact: true });
  await toggle.click();
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.swatch-info')).toHaveCount(5);
  await page.goto('/#111111#222222');
  await expect(page.locator('.swatch-info')).toHaveCount(2);
  await toggle.click();
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.swatch-info')).toHaveCount(0);
});

test('invalid or unavailable info storage defaults to off and leaves the toggle usable', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('palette:info', 'invalid'));
  await page.reload();
  const toggle = page.getByRole('button', { name: 'Color information', exact: true });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
  });
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(page.locator('.swatch-info')).toHaveCount(5);
});
