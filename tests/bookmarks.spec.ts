import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/#264653:Ocean#264653:Sea#E9C46A:Sand');
});

test('bookmarks are keyed by hex, persist across palettes, and can be removed', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit Ocean color 264653' }).click();
  const bookmark = page.getByRole('button', { name: 'Bookmark swatch', exact: true });
  await expect(bookmark).toHaveAttribute('aria-pressed', 'false');
  await bookmark.click();
  await expect(bookmark).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Edit Sea color 264653' }).click();
  await expect(bookmark).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('tab', { name: 'Bookmarks', exact: true }).click();
  const panel = page.getByRole('tabpanel', { name: 'Bookmarks', exact: true });
  await expect(panel.getByRole('listitem')).toHaveCount(1);
  await expect(panel.getByRole('listitem')).toHaveText('264653Ocean');
  await expect(panel.getByRole('button', { name: 'Remove bookmark Ocean 264653' })).toHaveCount(1);
  await page.goto('/?reopen#FFFFFF#264653:Different');
  await expect(panel.getByRole('listitem')).toHaveText('264653Ocean');
  await page.getByRole('button', { name: 'Edit Different color 264653' }).click();
  await expect(bookmark).toHaveAttribute('aria-pressed', 'true');
  await bookmark.click();
  await expect(bookmark).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('Escape');
  await expect(panel.getByRole('listitem')).toHaveCount(0);
  await page.reload();
  await expect(panel.getByText('No bookmarks', { exact: true })).toBeVisible();
});

test('accepted renames update the saved title while cancelled renames do not', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit Ocean color 264653' }).click();
  await page.getByRole('button', { name: 'Bookmark swatch', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Rename Sea', exact: true }).click();
  await page.getByRole('textbox', { name: 'Color Name' }).fill('Cancelled');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('tab', { name: 'Bookmarks', exact: true }).click();
  const saved = page.getByRole('tabpanel', { name: 'Bookmarks' }).getByRole('listitem');
  await expect(saved).toHaveText('264653Ocean');
  await page.getByRole('button', { name: 'Rename Sea', exact: true }).click();
  await page.getByRole('textbox', { name: 'Color Name' }).fill('Deep water');
  await page.keyboard.press('Enter');
  await expect(saved).toHaveText('264653Deep water');
  await page.reload();
  await expect(saved).toHaveText('264653Deep water');
});

test('bookmarking the current picker color leaves the palette edit cancellable', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit Ocean color 264653' }).click();
  await page.getByRole('textbox', { name: 'Hex color' }).fill('ABC123');
  await page.getByRole('button', { name: 'Bookmark swatch', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bookmark swatch', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Edit Ocean color 264653' })).toBeVisible();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('tab', { name: 'Bookmarks', exact: true }).click();
  await expect(page.getByRole('tabpanel', { name: 'Bookmarks' }).getByRole('listitem')).toHaveText('ABC123Ocean');
});

for (const width of [1440, 390, 320]) {
  test(`bookmark grid scrolls and fits the sidebar at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 600 });
    await page.evaluate(() => localStorage.setItem('palette:bookmarks', JSON.stringify(Array.from({ length: 30 }, (_, index) => [index.toString(16).padStart(6, '0'), `Saved color ${index}`]))));
    await page.reload();
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await page.getByRole('tab', { name: 'Bookmarks', exact: true }).click();
    const panel = page.getByRole('tabpanel', { name: 'Bookmarks' });
    await expect(panel.getByRole('listitem')).toHaveCount(30);
    await panel.getByRole('listitem').last().scrollIntoViewIfNeeded();
    await expect(page.getByRole('tablist')).toBeInViewport();
    expect(await page.locator('.sidebar-content').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });
}

test('invalid storage is ignored and blocked storage leaves bookmarking usable', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('palette:bookmarks', JSON.stringify([['abc123', 'Valid'], ['ABC123', 'Updated'], ['not hex', 'Invalid'], ['000000', null], null])));
  await page.reload();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('tab', { name: 'Bookmarks', exact: true }).click();
  await expect(page.getByRole('tabpanel', { name: 'Bookmarks' }).getByRole('listitem')).toHaveText(['ABC123Updated']);
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }));
  await page.reload();
  await page.getByRole('button', { name: 'Edit Ocean color 264653' }).click();
  const bookmark = page.getByRole('button', { name: 'Bookmark swatch', exact: true });
  await bookmark.click();
  await expect(bookmark).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('status')).toHaveText('Bookmarks could not be saved in this browser.');
});

test('hover and keyboard removal update bookmarks without changing the palette', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('palette:bookmarks', JSON.stringify([['264653', 'Ocean'], ['E9C46A', 'Sand']])));
  await page.reload();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('tab', { name: 'Bookmarks', exact: true }).click();
  const panel = page.getByRole('tabpanel', { name: 'Bookmarks', exact: true });
  const remove = page.getByRole('button', { name: 'Remove bookmark Ocean 264653' });
  await expect(remove).toHaveCSS('opacity', '0');
  await panel.getByRole('listitem').first().hover();
  await expect(remove).toHaveCSS('opacity', '1');
  await remove.click();
  await expect(panel.getByRole('listitem')).toHaveText(['E9C46ASand']);
  const remaining = page.getByRole('button', { name: 'Remove bookmark Sand E9C46A' });
  await expect(remaining).toBeFocused();
  await page.reload();
  await expect(panel.getByRole('listitem')).toHaveCount(1);
  await page.getByRole('button', { name: 'Edit Ocean color 264653' }).click();
  await expect(page.getByRole('button', { name: 'Bookmark swatch', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'Bookmarks', exact: true }).focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(panel).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(panel.getByRole('button', { name: 'Add Sand E9C46A to palette' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(remaining).toBeFocused();
  await expect(remaining).toHaveCSS('opacity', '1');
  await page.keyboard.press('Enter');
  await expect(panel).toBeFocused();
  await expect(panel.getByText('No bookmarks', { exact: true })).toBeVisible();
  await page.reload();
  await expect(panel.getByRole('listitem')).toHaveCount(0);
  await expect(page).toHaveURL(/#264653:Ocean#264653:Sea#E9C46A:Sand$/);
});

test('clicking or activating a bookmark appends its color and title, with undo and redo', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit Ocean color 264653' }).click();
  await page.getByRole('button', { name: 'Bookmark swatch', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('tab', { name: 'Bookmarks', exact: true }).click();
  const add = page.getByRole('button', { name: 'Add Ocean 264653 to palette' });
  await add.click();
  await expect(page.locator('.hex-button')).toHaveText(['264653', '264653', 'E9C46A', '264653']);
  await expect(page.locator('.name-button').last()).toHaveText('Ocean');
  await expect(page).toHaveURL(/#264653:Ocean#264653:Sea#E9C46A:Sand#264653:Ocean$/);
  await page.locator('.swatch').last().focus();
  await page.keyboard.press('Control+z');
  await expect(page.locator('.swatch')).toHaveCount(3);
  await page.keyboard.press('Control+Shift+z');
  await expect(page.locator('.swatch')).toHaveCount(4);
  await add.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.swatch')).toHaveCount(5);
  await expect(page.locator('.name-button').last()).toHaveText('Ocean');
  await expect(page.getByRole('tabpanel', { name: 'Bookmarks' }).getByRole('listitem')).toHaveCount(1);
  await page.getByRole('button', { name: 'Remove bookmark Ocean 264653' }).click();
  await expect(page.locator('.swatch')).toHaveCount(5);
});
