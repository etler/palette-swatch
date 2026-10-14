import { expect, test, type Page } from '@playwright/test';

const endpoint = 'https://www.sherwin-williams.com/color-visualization/services/color/SW/all';
const colors = [
  { name: 'Night Sky', colorNumber: '0001', rgb: 0x001122, colorFamilyNames: ['Blue'] },
  { name: 'Snow Cloud', colorNumber: '0002', rgb: 0xFFFFFF, colorFamilyNames: ['White & Pastel'] },
  { name: 'Bison', colorNumber: '1084', rgb: 0x123456 },
  ...Array.from({ length: 35 }, (_, index) => ({ name: `Blue Cloud ${index + 1}`, colorNumber: String(index + 10), rgb: 0x99CCFF, colorFamilyNames: ['Blue'] })),
];
const openSearch = async (page: Page) => {
  await page.locator('.hex-button').first().click();
  await page.getByRole('button', { name: 'Search colors', exact: true }).click();
};
test.beforeEach(async ({ page }) => {
  await page.route(endpoint, route => route.fulfill({ json: colors }));
  await page.goto('/#264653:Ocean#2A9D8F');
});

test('browses families with a sticky back button and contrasting swatch labels', async ({ page }) => {
  await openSearch(page);
  await expect(page.getByRole('button', { name: 'Back to picker' })).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('searchbox')).toBeFocused();
  await page.getByRole('button', { name: 'Blue', exact: true }).click();
  await expect(page.getByRole('searchbox')).toHaveCount(0);
  const back = page.getByRole('button', { name: 'Blue', exact: true });
  await expect(back).toBeFocused();
  const swatches = page.locator('.search-swatch');
  await expect(swatches).toHaveCount(36);
  await expect(swatches.first()).toHaveCSS('background-color', 'rgb(0, 17, 34)');
  await expect(swatches.first()).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(swatches.nth(1)).toHaveCSS('color', 'rgb(0, 0, 0)');
  const y = (await back.boundingBox())!.y;
  await page.getByRole('dialog').evaluate(element => { element.scrollTop = 500; });
  expect((await back.boundingBox())!.y).toBeCloseTo(y, 0);
  await back.click();
  await expect(page.getByRole('searchbox')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'White & Pastel', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to picker' }).click();
  await expect(page.getByRole('textbox', { name: 'Hex color' })).toHaveValue('264653');
});

test('matches substrings without case sensitivity and keeps the search input sticky', async ({ page }) => {
  await openSearch(page);
  const input = page.getByRole('searchbox');
  await input.fill('  cLoU  ');
  await expect(page.locator('.search-swatch')).toHaveCount(36);
  const y = (await input.boundingBox())!.y;
  await page.getByRole('dialog').evaluate(element => { element.scrollTop = 500; });
  expect((await input.boundingBox())!.y).toBeCloseTo(y, 0);
  await input.fill('isON');
  await expect(page.locator('.search-swatch')).toHaveText('Bison');
  await input.fill('no such color');
  await expect(page.getByText('No colors found.')).toBeVisible();
  await input.fill('sky');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Night Sky', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox', { name: 'Color Name' })).toHaveValue('Night Sky');
  await expect(page.getByRole('textbox', { name: 'Hex color' })).toHaveValue('001122');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#001122:Night%20Sky#2A9D8F$/);
  await page.keyboard.press('Control+z');
  await expect(page).toHaveURL(/#264653:Ocean#2A9D8F$/);
});

test('ranks multiword matches independently of the search word order', async ({ page }) => {
  const names = ['Offwhite Darkkestrel', 'White Darkkestrel', 'Offwhite Kestrel', 'Kestrel Offwhite', 'Kestrel White', 'White'];
  await page.route(endpoint, route => route.fulfill({ json: names.map((name, index) => ({ ...colors[0], name, colorNumber: String(index) })) }));
  await openSearch(page);
  const expected = ['Kestrel White', 'Kestrel Offwhite', 'Offwhite Kestrel', 'White Darkkestrel', 'Offwhite Darkkestrel'];
  await page.getByRole('searchbox').fill('white kestrel');
  await expect(page.locator('.search-swatch')).toHaveText(expected);
  await page.getByRole('searchbox').fill('kestrel white');
  await expect(page.locator('.search-swatch')).toHaveText(expected);
});

test('search bookmarks have independent mouse and keyboard targets and persist by hex', async ({ page }) => {
  await openSearch(page);
  const input = page.getByRole('searchbox');
  await input.fill('sky');
  const bookmark = page.getByRole('button', { name: 'Bookmark Night Sky', exact: true });
  await expect(bookmark).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(bookmark).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await bookmark.hover();
  await expect(bookmark).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await bookmark.click();
  await expect(bookmark).toHaveAttribute('aria-pressed', 'true');
  await expect(input).toBeVisible();
  await expect(page.locator('.hex-button').first()).toHaveText('264653');
  await expect(page).toHaveURL(/#264653:Ocean#2A9D8F$/);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('palette:bookmarks') ?? '[]'))).toEqual([['001122', 'Night Sky']]);
  await input.fill('snow');
  await expect(page.getByRole('button', { name: 'Bookmark Snow Cloud', exact: true })).toHaveCSS('color', 'rgb(0, 0, 0)');
  await input.fill('sky');
  await expect(bookmark).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Night Sky', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(bookmark).toBeFocused();
  await page.keyboard.press('Space');
  await expect(bookmark).toHaveAttribute('aria-pressed', 'false');
  await expect(input).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(bookmark).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await openSearch(page);
  await input.fill('sky');
  await expect(bookmark).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Night Sky', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bookmark swatch', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('textbox', { name: 'Hex color' })).toHaveValue('001122');
});

for (const action of ['cancel', 'outside'] as const) {
  test(`search selection follows picker ${action} behavior`, async ({ page }) => {
    await openSearch(page);
    await page.getByRole('searchbox').fill('snow');
    await page.getByRole('button', { name: 'Snow Cloud', exact: true }).click();
    if (action === 'cancel') await page.keyboard.press('Escape');
    else await page.mouse.click(1400, 20);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).toHaveURL(action === 'cancel' ? /#264653:Ocean#2A9D8F$/ : /#FFFFFF:Snow%20Cloud#2A9D8F$/);
  });
}

test('keeps draft fields across search and Escape cancels from the search view', async ({ page }) => {
  await page.locator('.hex-button').first().click();
  await page.getByRole('textbox', { name: 'Color Name' }).fill('Sea');
  await page.getByRole('textbox', { name: 'Hex color' }).fill('112233');
  await page.getByRole('button', { name: 'Search colors', exact: true }).click();
  await page.getByRole('button', { name: 'Back to picker' }).click();
  await expect(page.getByRole('textbox', { name: 'Color Name' })).toHaveValue('Sea');
  await expect(page.getByRole('textbox', { name: 'Hex color' })).toHaveValue('112233');
  await page.getByRole('button', { name: 'Search colors', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/#264653:Ocean#2A9D8F$/);
});

test('stores a timestamped catalog and reuses it after page reload', async ({ page }) => {
  await openSearch(page);
  await expect(page.getByRole('button', { name: 'Blue', exact: true })).toBeVisible();
  const cache = await page.evaluate(() => JSON.parse(localStorage.getItem('palette-sherwin-williams')!));
  expect(cache.timestamp).toBeGreaterThan(Date.now() - 60_000);
  expect(cache.colors).toHaveLength(colors.length);
  await page.route(endpoint, () => { throw new Error('Fresh cache must not fetch'); });
  await page.reload();
  await openSearch(page);
  await expect(page.getByRole('button', { name: 'Blue', exact: true })).toBeVisible();
});

test('shows failure and retries without closing the picker', async ({ page }) => {
  await page.route(endpoint, route => route.fulfill({ status: 503, body: '' }));
  await openSearch(page);
  await expect(page.getByRole('alert')).toHaveText('Unable to load colors.');
  await page.route(endpoint, route => route.fulfill({ json: colors }));
  await page.getByRole('button', { name: 'Retry' }).click();
  await page.getByRole('button', { name: 'Blue', exact: true }).click();
  await expect(page.locator('.search-swatch')).toHaveCount(36);
});

test('mobile search does not autofocus inputs and the family list scrolls in landscape', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.route(endpoint, route => route.fulfill({ json: colors }));
  await page.goto('/#264653:Ocean#2A9D8F');
  await page.locator('.hex-button').first().tap();
  await page.getByRole('button', { name: 'Search colors', exact: true }).tap();
  await expect(page.getByRole('searchbox')).not.toBeFocused();
  await page.getByRole('button', { name: 'Blue', exact: true }).tap();
  const swatch = await page.locator('.search-swatch').nth(2).boundingBox();
  const session = await context.newCDPSession(page);
  const x = swatch!.x + swatch!.width / 2;
  const y = swatch!.y + 20;
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (const offset of [20, 50, 80, 120]) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - offset }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => page.getByRole('dialog').evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Blue', exact: true })).toBeInViewport();
  await page.getByRole('button', { name: 'Blue', exact: true }).tap();
  await expect(page.getByRole('searchbox')).not.toBeFocused();
  await page.getByRole('searchbox').fill('sky');
  const bookmark = page.getByRole('button', { name: 'Bookmark Night Sky', exact: true });
  await bookmark.tap();
  await expect(bookmark).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('searchbox')).toBeVisible();
  await expect(page.locator('.hex-button').first()).toHaveText('264653');
  await page.getByRole('button', { name: 'Night Sky', exact: true }).tap();
  await expect(page.getByRole('textbox', { name: 'Hex color' })).toHaveValue('001122');
  await context.close();
});
