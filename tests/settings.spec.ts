import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/#264653#2A9D8F#E9C46A#F4A261#E76F51');
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`settings reserves space and keeps palette controls usable at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const button = page.getByRole('button', { name: 'Menu', exact: true });
    await expect(button).toHaveCSS('opacity', '0');
    await button.hover();
    await expect(button).toHaveCSS('opacity', '1');
    await button.click();
    const panel = page.getByRole('complementary', { name: 'Palette menu' });
    await expect(panel).toBeVisible();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(panel).toHaveCSS('width', `${Math.max(220, Math.min(340, viewport.width / 2))}px`);
    const bounds = await panel.boundingBox();
    const palette = await page.getByRole('main').boundingBox();
    expect(bounds!.x).toBe(palette!.width);
    expect(bounds!.x + bounds!.width).toBe(viewport.width);
    expect(bounds!.height).toBe(viewport.height);
    expect(palette!.width).toBeLessThan(viewport.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
    const corner = await button.boundingBox();
    expect(corner!.x + corner!.width).toBeLessThanOrEqual(bounds!.x);
    const width = page.getByRole('spinbutton', { name: 'Minimum swatch width' });
    await expect(page.getByRole('tab', { name: 'Settings', exact: true })).toBeFocused();
    await width.press('ArrowUp');
    await expect(width).toHaveValue('101');
    await expect(width).toBeFocused();
    await page.getByRole('tab', { name: 'Settings', exact: true }).focus();
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('button', { name: /^Change outline color/ })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('tab', { name: 'Settings', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Add name for Color 1', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Rename color' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add name for Color 1', exact: true })).toBeFocused();
    await page.locator('.swatch').first().focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.swatch').nth(1)).toBeFocused();
    await page.keyboard.press('Delete');
    await expect(page.locator('.swatch')).toHaveCount(4);
    await expect(panel).toBeVisible();
    const swatch = page.locator('.swatch').first();
    const start = await swatch.boundingBox();
    await page.mouse.move(start!.x + start!.width / 2, start!.y + start!.height / 4);
    await page.mouse.down();
    await page.mouse.move(viewport.width - 20, start!.y + start!.height / 4);
    await expect.poll(() => swatch.evaluate(element => element.getBoundingClientRect().right)).toBeCloseTo(bounds!.x, 0);
    await page.mouse.up();
    await expect(panel).toBeVisible();
    await width.fill('250');
    await width.press('Control+Space');
    await expect(page.getByRole('main')).toHaveAttribute('data-outline', 'outer');
    await width.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(button).toBeFocused();
    await expect(page.getByRole('main')).toHaveCSS('width', `${viewport.width}px`);
    await button.press('Enter');
    await expect(width).toHaveValue('100');
    await button.click();
    await expect(panel).toHaveCount(0);
  });
}

test('saving sizes changes wrapping and equal outline gaps and survives reload', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Minimum swatch width' }).fill('190');
  await page.getByRole('spinbutton', { name: 'Window outline width' }).fill('20');
  await page.getByRole('spinbutton', { name: 'Border outline width' }).fill('12');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('complementary', { name: 'Palette menu' })).toBeVisible();
  await page.getByRole('button', { name: 'Close menu' }).click();
  const palette = page.getByRole('main');
  await expect(palette).toHaveCSS('--rows', '2');
  await expect(page.locator('.empty-swatch')).toHaveCount(1);
  await page.keyboard.press('Control+Space');
  await expect(palette).toHaveCSS('border-top-width', '20px');
  await page.keyboard.press('Control+Space');
  await expect(palette).toHaveCSS('border-top-width', '12px');
  await expect(palette).toHaveCSS('column-gap', '12px');
  await expect(palette).toHaveCSS('row-gap', '12px');
  await expect(palette).toHaveCSS('--rows', '3');
  await page.reload();
  await expect(palette).toHaveCSS('border-top-width', '12px');
  await expect(palette).toHaveCSS('--rows', '3');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Minimum swatch width' })).toHaveValue('190');
  await expect(page.getByRole('spinbutton', { name: 'Window outline width' })).toHaveValue('20');
  await expect(page.getByRole('spinbutton', { name: 'Border outline width' })).toHaveValue('12');
});

test('invalid inputs cannot save and reset restores the responsive defaults', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const open = page.getByRole('button', { name: 'Menu', exact: true });
  await open.click();
  const minimum = page.getByRole('spinbutton', { name: 'Minimum swatch width' });
  const border = page.getByRole('spinbutton', { name: 'Border outline width' });
  await minimum.fill('0');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Palette menu' })).toBeVisible();
  await minimum.fill('180');
  await border.fill('25');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('complementary', { name: 'Palette menu' })).toBeVisible();
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(minimum).toHaveValue('100');
  await expect(border).toHaveValue('');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.keyboard.press('Control+Space');
  await expect(page.getByRole('main')).toHaveCSS('border-top-width', '32px');
  await page.keyboard.press('Control+Space');
  await expect(page.getByRole('main')).toHaveCSS('border-top-width', '8px');
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole('main')).toHaveCSS('border-top-width', '16px');
});

test('corrupt settings and blocked storage do not break the palette', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('palette:settings', JSON.stringify({ minimumSwatchWidth: -1, windowOutlineWidth: 'huge', borderOutlineWidth: 4 })));
  await page.reload();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Minimum swatch width' })).toHaveValue('100');
  await expect(page.getByRole('spinbutton', { name: 'Window outline width' })).toHaveValue('');
  await expect(page.getByRole('spinbutton', { name: 'Border outline width' })).toHaveValue('4');
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
  });
  await page.reload();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Minimum swatch width' }).fill('400');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('complementary', { name: 'Palette menu' })).toBeVisible();
  await page.getByRole('button', { name: 'Close menu' }).click();
  await expect(page.getByRole('main')).toHaveCSS('--rows', '2');
});

test('zero outline widths resolve to Auto when entered or loaded from storage', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('palette:settings', JSON.stringify({
    minimumSwatchWidth: 100, windowOutlineWidth: 0, borderOutlineWidth: 0,
  })));
  await page.reload();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  for (const name of ['Window outline width', 'Border outline width']) {
    const input = page.getByRole('spinbutton', { name });
    await expect(input).toHaveValue('');
    await expect(input).toHaveAttribute('placeholder', 'Auto');
    await input.fill('1');
    await input.press('ArrowDown');
    await expect(input).toHaveValue('');
    await input.fill('20');
    await input.fill('0');
    await expect(input).toHaveValue('');
  }
  await page.keyboard.press('Enter');
  await page.keyboard.press('Control+Space');
  await expect(page.getByRole('main')).toHaveCSS('border-top-width', '48px');
  await page.keyboard.press('Control+Space');
  await expect(page.getByRole('main')).toHaveCSS('border-top-width', '16px');
  await page.reload();
  await expect(page.getByRole('main')).toHaveCSS('border-top-width', '16px');
  await expect(page.getByRole('spinbutton', { name: 'Window outline width' })).toHaveValue('');
  await expect(page.getByRole('spinbutton', { name: 'Border outline width' })).toHaveValue('');
});

test('Shift+/ toggles settings without repeating or interrupting name entry', async ({ page }) => {
  const panel = page.getByRole('complementary', { name: 'Palette menu' });
  await page.keyboard.down('Shift');
  await page.keyboard.down('Slash');
  await expect(panel).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Settings', exact: true })).toBeFocused();
  await page.keyboard.down('Slash');
  await expect(panel).toBeVisible();
  await page.keyboard.up('Slash');
  await page.keyboard.up('Shift');
  await page.keyboard.press('Shift+Slash');
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Slash');
  await expect(panel).toBeVisible();
  await page.keyboard.press('Shift+Slash');
  await expect(panel).toHaveCount(0);
  await page.getByRole('button', { name: 'Add name for Color 1', exact: true }).click();
  await page.keyboard.press('Shift+?');
  await expect(page.getByRole('textbox', { name: 'Color Name' })).toHaveValue('?');
  await expect(panel).toHaveCount(0);
});

for (const width of [1440, 390]) {
  test(`sidebar tabs preserve drafts and keyboard shortcuts scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    const settings = page.getByRole('tab', { name: 'Settings', exact: true });
    const keyboard = page.getByRole('tab', { name: 'Keyboard shortcuts' });
    const minimum = page.getByRole('spinbutton', { name: 'Minimum swatch width' });
    await expect(settings).toBeFocused();
    await minimum.fill('230');
    await keyboard.click();
    const shortcuts = page.getByRole('tabpanel', { name: 'Keyboard shortcuts' });
    await expect(shortcuts).toBeVisible();
    await expect(keyboard).toHaveAttribute('aria-selected', 'true');
    await expect(minimum).toBeHidden();
    await expect(shortcuts.getByText('Shift + /', { exact: true })).toBeVisible();
    await keyboard.press('ArrowRight');
    await expect(settings).toBeFocused();
    await expect(minimum).toHaveValue('230');
    await settings.press('End');
    await expect(keyboard).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Close menu' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(shortcuts).toBeFocused();
    await page.keyboard.press('End');
    await expect.poll(() => page.locator('.sidebar-body').evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    await expect(page.getByRole('tablist')).toBeInViewport();
    await expect(shortcuts.getByText('Close sidebar', { exact: true })).toBeInViewport();
    await page.keyboard.press('Shift+Slash');
    await page.keyboard.press('Shift+Slash');
    await expect(keyboard).toBeFocused();
    await keyboard.press('Home');
    await expect(settings).toBeFocused();
    await expect(minimum).toHaveValue('100');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });
}

for (const [platform, modifier, alt, enter, deletion, redo] of [
  ['MacIntel', '⌘', '⌥', 'Return', 'Delete', '⌘ + Shift + Z'],
  ['Win32', 'Ctrl', 'Alt', 'Enter', 'Delete / Backspace', 'Ctrl + Shift + Z; Ctrl + Y'],
  ['Linux x86_64', 'Ctrl', 'Alt', 'Enter', 'Delete / Backspace', 'Ctrl + Shift + Z; Ctrl + Y'],
  ['iPad', '⌘', '⌥', 'Return', 'Delete', '⌘ + Shift + Z'],
]) {
  test(`shortcut labels match the browser platform ${platform}`, async ({ page }) => {
    await page.addInitScript(platform => Object.defineProperty(navigator, 'platform', { value: platform }), platform);
    await page.reload();
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await page.getByRole('tab', { name: 'Keyboard shortcuts' }).click();
    const panel = page.getByRole('tabpanel', { name: 'Keyboard shortcuts' });
    for (const [action, keys] of [
      ['Undo', `${modifier} + Z`],
      ['Copy selected hex', `${modifier} + C`],
      ['Toggle fullscreen', `${alt} + ${enter}`],
      ['Delete selected swatch', deletion],
      ['Redo', redo],
      ['Save settings', enter],
    ]) {
      await expect(panel.locator('dl > div').filter({ has: page.getByText(action, { exact: true }) }).locator('kbd')).toHaveText(keys);
    }
    await expect(panel).not.toContainText('Ctrl / ⌘');
  });
}

for (const label of ['Settings', 'Accessibility', 'Bookmarks', 'Export', 'Keyboard shortcuts']) {
  test(`sidebar remembers open and closed states and the ${label} tab`, async ({ page, context }) => {
    const menu = page.getByRole('button', { name: 'Menu', exact: true });
    await menu.click();
    await page.getByRole('tab', { name: label, exact: true }).click();
    await page.reload();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('tab', { name: label, exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel', { name: label, exact: true })).toBeVisible();
    const reopened = await context.newPage();
    await reopened.goto('/#FFFFFF#000000');
    await expect(reopened.getByRole('button', { name: 'Menu', exact: true })).toHaveAttribute('aria-expanded', 'true');
    await expect(reopened.getByRole('tab', { name: label, exact: true })).toHaveAttribute('aria-selected', 'true');
    await reopened.close();
    await page.keyboard.press('Shift+Slash');
    await page.reload();
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('complementary', { name: 'Palette menu' })).toHaveCount(0);
    await menu.click();
    await expect(page.getByRole('tab', { name: label, exact: true })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('button', { name: 'Close menu' }).click();
    await page.reload();
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
  });
}

test('invalid sidebar preferences fall back to closed Settings', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('palette:sidebar-open', 'yes');
    localStorage.setItem('palette:sidebar-tab', 'unknown');
  });
  await page.reload();
  const menu = page.getByRole('button', { name: 'Menu', exact: true });
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await menu.click();
  await expect(page.getByRole('tab', { name: 'Settings', exact: true })).toHaveAttribute('aria-selected', 'true');
});
