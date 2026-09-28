import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const hash = '#000000:Night#FFFFFF#2A9D8F:Ocean#E9C46A#F4A261#E76F51';
const formats = ['Print / PDF', 'CSS', 'Tailwind CSS', 'JSON', 'CSV', 'Text', 'Adobe ASE', 'GIMP GPL', 'PNG', 'SVG'];
const downloads = [['PNG', 'palette.png'], ['SVG', 'palette.svg'], ['Adobe ASE', 'palette.ase'], ['GIMP GPL', 'palette.gpl']] as const;
const copies = [['CSS', '--swatch-3-ocean: #2A9D8F;'], ['Tailwind CSS', '--color-swatch-3-ocean: #2A9D8F;'], ['JSON', '"name": "Ocean"'], ['CSV', '"#2A9D8F","Ocean"'], ['Text', '#2A9D8F\tOcean']] as const;

for (const standalone of [false, true]) {
  test(`exports copy text and download files offline from ${standalone ? 'the built HTML file' : 'the development page'}`, async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    if (standalone) await context.setOffline(true);
    await page.goto(`${standalone ? pathToFileURL(resolve('dist/index.html')).href : '/'}${hash}`);
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await page.getByRole('tab', { name: 'Export', exact: true }).click();
    await context.setOffline(true);
    const requests: string[] = [];
    page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    const downloaded: string[] = [];
    page.on('download', download => downloaded.push(download.suggestedFilename()));
    for (const [format, expected] of copies) {
      await page.evaluate(() => navigator.clipboard.writeText('previous clipboard'));
      const button = page.getByRole('button', { name: format, exact: true });
      await expect(button).toHaveAttribute('title', `Copy ${format}`);
      await button.click();
      await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain(expected);
    }
    expect(downloaded).toEqual([]);
    for (const [format, filename] of downloads) {
      const downloading = page.waitForEvent('download');
      await page.getByRole('button', { name: format, exact: true }).click();
      const download = await downloading;
      expect(download.suggestedFilename()).toBe(filename);
      expect(await download.failure()).toBeNull();
      const path = await download.path();
      if (!path) throw new Error('Missing download');
      const bytes = await readFile(path);
      expect(bytes.length).toBeGreaterThan(20);
      if (format === 'PNG') {
        expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
        expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([2400, 1280]);
        const pixels = await page.evaluate(async data => {
          const image = new Image();
          image.src = `data:image/png;base64,${data}`;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = image.width; canvas.height = image.height;
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Canvas unavailable');
          context.drawImage(image, 0, 0);
          return [10, 490, 970].map(x => [...context.getImageData(x, 10, 1, 1).data]);
        }, bytes.toString('base64'));
        expect(pixels).toEqual([[0, 0, 0, 255], [255, 255, 255, 255], [42, 157, 143, 255]]);
      } else if (format === 'Adobe ASE') {
        expect(bytes.subarray(0, 4).toString()).toBe('ASEF');
        expect(bytes.readUInt32BE(8)).toBe(6);
      } else if (format === 'SVG') {
        const svg = await page.evaluate(text => {
          const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
          return { errors: doc.querySelectorAll('parsererror').length, colors: [...doc.querySelectorAll('rect')].map(el => el.getAttribute('fill')) };
        }, bytes.toString());
        expect(svg).toEqual({ errors: 0, colors: ['#000000', '#FFFFFF', '#2A9D8F', '#E9C46A', '#F4A261', '#E76F51'] });
      } else if (format === 'GIMP GPL') expect(bytes.toString()).toContain('255 255 255');
    }
    expect(downloaded).toEqual(downloads.map(([, filename]) => filename));
    expect(requests).toEqual([]);
    await expect(page.locator('.swatch')).toHaveCount(6);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
}

for (const width of [1440, 390, 320]) {
  test(`export tab remains keyboard accessible without overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    await page.goto(`/${hash}`);
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await page.getByRole('tab', { name: 'Bookmarks', exact: true }).click();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Export', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Close menu' })).toBeFocused();
    for (const format of formats) {
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: format, exact: true })).toBeFocused();
      await expect(page.getByRole('button', { name: format, exact: true })).toBeInViewport();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    expect(await page.locator('.sidebar-content').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  });
}

test('exports reflect live edits and original colors during vision simulation', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(`/${hash}`);
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('tab', { name: 'Accessibility', exact: true }).click();
  await page.getByLabel('Vision Simulation').selectOption('Grayscale');
  await page.getByRole('tab', { name: 'Export', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Ocean color 2A9D8F', exact: true }).click();
  await page.getByRole('textbox', { name: 'Hex color' }).fill('123ABC');
  await page.keyboard.press('Enter');
  await page.evaluate(() => navigator.clipboard.writeText('[]'));
  await page.getByRole('button', { name: 'JSON', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect.poll(async () => JSON.parse(await page.evaluate(() => navigator.clipboard.readText()))[2]).toEqual({ hex: '#123ABC', name: 'Ocean' });
});

test('Print / PDF opens browser printing and its layout includes every swatch', async ({ page }) => {
  await page.goto(`/${hash}`);
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('tab', { name: 'Export', exact: true }).click();
  await page.evaluate(() => { window.print = () => { document.body.dataset.printed = 'true'; }; });
  await page.getByRole('button', { name: 'Print / PDF', exact: true }).click();
  await expect(page.locator('body')).toHaveAttribute('data-printed', 'true');
  await expect(page.locator('.palette-print')).toBeHidden();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#root')).toBeHidden();
  await expect(page.locator('.print-swatch')).toHaveCount(6);
  await expect(page.locator('.print-swatch').first()).toHaveText('000000Night');
  await expect(page.locator('.print-swatch').nth(1)).toHaveText('FFFFFF');
  await expect(page.locator('.print-swatch').nth(2)).toHaveCSS('background-color', 'rgb(42, 157, 143)');
  const pdf = await page.pdf();
  expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
});


test('clipboard denial reports an error without downloading or changing the palette', async ({ page }) => {
  await page.goto(`/${hash}`);
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('tab', { name: 'Export', exact: true }).click();
  await page.evaluate(() => {
    navigator.clipboard.write = async () => { throw new DOMException('Denied', 'NotAllowedError'); };
  });
  const downloaded: string[] = [];
  page.on('download', download => downloaded.push(download.suggestedFilename()));
  await page.getByRole('button', { name: 'CSS', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('CSS export failed. Please try again.');
  expect(downloaded).toEqual([]);
  expect(new URL(page.url()).hash).toBe(hash);
});
