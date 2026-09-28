import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/#264653#2A9D8F#E9C46A#F4A261#E76F51');
  await page.clock.install();
});

for (const modifier of ['Control', 'Meta']) {
  test(`${modifier}+Space cycles all outline modes without changing the palette or selection`, async ({ page }) => {
    const palette = page.getByRole('main');
    const selected = page.getByRole('region', { name: 'Color 3', exact: true });
    await selected.click({ position: { x: 100, y: 200 } });
    for (const mode of ['outer', 'swatches', 'none']) {
      await page.keyboard.press(`${modifier}+Space`);
      await page.clock.runFor(400);
      await expect(palette).toHaveAttribute('data-outline', mode);
      await expect(selected).toBeFocused();
      await expect(selected).toHaveCSS('outline-style', 'none');
      const border = palette;
      await expect(border).toHaveCSS('border-top-width', mode === 'outer' ? '48px' : mode === 'swatches' ? '16px' : '0px');
      await expect(border).toHaveCSS('border-top-color', 'rgb(255, 255, 255)');
    }
    await expect(page).toHaveURL(/#264653#2A9D8F#E9C46A#F4A261#E76F51$/);
  });

  test(`${modifier}+Shift+Space toggles outline color immediately without cycling visible modes`, async ({ page }) => {
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    const palette = page.getByRole('main');
    await page.keyboard.press(`${modifier}+Shift+Space`);
    await expect(palette).toHaveAttribute('data-outline', 'outer');
    await expect(palette).toHaveCSS('--outline-color', 'black');
    for (const mode of ['outer', 'swatches']) {
      for (const color of ['white', 'black']) {
        await page.keyboard.press(`${modifier}+Shift+Space`);
        await expect(palette).toHaveAttribute('data-outline', mode);
        await expect(palette).toHaveCSS('--outline-color', color);
      }
      await page.keyboard.press(`${modifier}+Space`);
    }
    await expect(palette).toHaveAttribute('data-outline', 'none');
    await expect(palette).toHaveCSS('--outline-color', 'black');
  });

  for (const shift of [false, true]) {
    test(`${modifier}${shift ? '+Shift' : ''}+Space acts on keydown and ignores held-key repeats`, async ({ page }) => {
      const palette = page.getByRole('main');
      await page.keyboard.down(modifier);
      if (shift) await page.keyboard.down('Shift');
      await page.keyboard.down('Space');
      await expect(palette).toHaveAttribute('data-outline', 'outer');
      await page.keyboard.down('Space');
      await page.clock.runFor(400);
      await page.keyboard.down('Space');
      await expect(palette).toHaveAttribute('data-outline', 'outer');
      await expect(palette).toHaveCSS('--outline-color', shift ? 'black' : 'white');
      await page.keyboard.up('Space');
      if (shift) await page.keyboard.up('Shift');
      await page.keyboard.up(modifier);
    });
  }
}

for (const corner of ['top-left', 'bottom-left', 'top-right', 'bottom-right']) {
  test(`${corner} outline control performs the same action on every click, including a double-click`, async ({ page }) => {
    const palette = page.getByRole('main');
    const button = page.locator(`.outline-zone-${corner} button`);
    const colorControl = corner.endsWith('right');
    await expect(button).toHaveAccessibleName(colorControl ? /^Change outline color/ : /^Cycle outline mode/);
    await expect(button).toHaveAttribute('tabindex', corner.startsWith('top') ? '0' : '-1');
    await expect(button).toHaveCSS('opacity', '0');
    await button.hover();
    await expect(button).toHaveCSS('opacity', '1');
    await button.click();
    expect(await palette.getAttribute('data-outline')).toBe('outer');
    await page.clock.runFor(400);
    await expect(palette).toHaveAttribute('data-outline', 'outer');
    await expect(palette).toHaveCSS('--outline-color', colorControl ? 'black' : 'white');
    await button.dblclick();
    await expect(palette).toHaveAttribute('data-outline', colorControl ? 'outer' : 'none');
    await expect(palette).toHaveCSS('--outline-color', colorControl ? 'black' : 'white');
    await button.click();
    await expect(palette).toHaveAttribute('data-outline', 'outer');
    await expect(palette).toHaveCSS('--outline-color', 'white');
  });
}

test('Tab reaches both top outline actions without repeating the bottom controls', async ({ page }) => {
  const palette = page.getByRole('main');
  await page.getByRole('button', { name: 'Add color at position 6', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('.outline-zone-top-left button')).toBeFocused();
  await page.keyboard.press('Enter');
  await page.clock.runFor(400);
  await expect(palette).toHaveAttribute('data-outline', 'outer');
  await page.keyboard.press('Tab');
  await expect(page.locator('.outline-zone-top-right button')).toBeFocused();
  await page.keyboard.press('Enter');
  await page.clock.runFor(400);
  await expect(palette).toHaveAttribute('data-outline', 'outer');
  await expect(palette).toHaveCSS('--outline-color', 'black');
  await page.keyboard.press('Tab');
  await expect(page.locator('.outline-button:focus')).toHaveCount(0);
});

test('outline shortcuts preserve popup edits and borders leave swatch controls usable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Edit Color 2 color 2A9D8F' }).click();
  await page.getByRole('textbox', { name: 'Hex color' }).fill('123456');
  await page.keyboard.press('Control+Space');
  await page.clock.runFor(400);
  await expect(page.getByRole('textbox', { name: 'Hex color' })).toHaveValue('123456');
  await page.keyboard.press('Escape');
  const swatch = page.getByRole('region', { name: 'Color 2', exact: true });
  await swatch.locator('.delete-zone-top button').click();
  await expect(page.locator('.swatch')).toHaveCount(4);
  await page.keyboard.press('Control+z');
  await expect(swatch).toBeVisible();
  await page.keyboard.press('Control+Space');
  await page.clock.runFor(400);
  const from = await swatch.boundingBox();
  const to = await page.getByRole('region', { name: 'Color 3', exact: true }).boundingBox();
  if (!from || !to) throw new Error('Expected visible swatches');
  await page.mouse.move(from.x + from.width / 2, from.y + 100);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + 100, { steps: 10 });
  await page.mouse.up();
  await expect(page.locator('.hex-button')).toHaveText(['264653', 'E9C46A', '2A9D8F', 'F4A261', 'E76F51']);
});

test('outside borders shrink the swatch area and dragging uses its inset coordinates', async ({ page }) => {
  const palette = page.getByRole('main');
  await page.keyboard.press('Control+Space');
  await page.clock.runFor(400);
  await expect(palette).toHaveCSS('border-top-width', '48px');
  const first = page.getByRole('region', { name: 'Color 1', exact: true });
  const last = page.getByRole('region', { name: 'Color 5', exact: true });
  await expect.poll(() => first.evaluate(element => Math.round(element.getBoundingClientRect().width * 10) / 10)).toBe(268.8);
  const bounds = await first.boundingBox();
  expect(bounds).toMatchObject({ x: 48, y: 48, height: 804 });
  expect(await last.evaluate(element => Math.round(element.getBoundingClientRect().right))).toBe(1392);
  expect(await page.locator('.outline-zone-top-left').boundingBox()).toMatchObject({ x: 0, y: 0 });
  await page.mouse.move(10, 200);
  await page.mouse.down();
  await expect(page.locator('.dragged')).toHaveCount(0);
  await page.mouse.up();
  await page.mouse.move(290, 200);
  await page.mouse.down();
  await expect(first).toHaveClass(/dragged/);
  await page.mouse.move(441, 200, { steps: 10 });
  await page.mouse.up();
  await expect(page.locator('.hex-button')).toHaveText(['2A9D8F', '264653', 'E9C46A', 'F4A261', 'E76F51']);
});

test('outer and individual borders animate expansion and contraction', async ({ page }) => {
  const palette = page.getByRole('main');
  await page.keyboard.press('Control+Space');
  await page.clock.runFor(400);
  await expect.poll(() => palette.evaluate(element => parseFloat(getComputedStyle(element).borderTopWidth))).toBeGreaterThan(0);
  expect(await palette.evaluate(element => parseFloat(getComputedStyle(element).borderTopWidth))).toBeLessThan(48);
  await expect(palette).toHaveCSS('border-top-width', '48px');
  await page.keyboard.press('Control+Space');
  await page.clock.runFor(400);
  await expect.poll(() => palette.evaluate(element => parseFloat(getComputedStyle(element).borderTopWidth))).toBeLessThan(48);
  expect(await palette.evaluate(element => parseFloat(getComputedStyle(element).borderTopWidth))).toBeGreaterThan(0);
  await expect.poll(() => palette.evaluate(element => parseFloat(getComputedStyle(element).columnGap))).toBeGreaterThan(0);
  expect(await palette.evaluate(element => parseFloat(getComputedStyle(element).columnGap))).toBeLessThan(16);
  await expect(palette).toHaveCSS('column-gap', '16px');
  await page.keyboard.press('Control+Space');
  await page.clock.runFor(400);
  await expect.poll(() => palette.evaluate(element => parseFloat(getComputedStyle(element).columnGap))).toBeLessThan(16);
  expect(await palette.evaluate(element => parseFloat(getComputedStyle(element).columnGap))).toBeGreaterThan(0);
  await expect(palette).toHaveCSS('column-gap', '0px');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.keyboard.press('Control+Space');
  await page.clock.runFor(400);
  await expect(palette).toHaveCSS('border-top-width', '48px');
  expect(await palette.evaluate(element => element.getAnimations().length)).toBe(0);
});

for (const width of [1440, 1000, 390]) {
  test(`swatch outline edges and gaps stay equal at ${width}px after adding, swapping, and deleting`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const palette = page.getByRole('main');
    for (const mode of ['outer', 'swatches']) {
      await page.keyboard.press('Control+Space');
      await page.clock.runFor(400);
      await expect(palette).toHaveAttribute('data-outline', mode);
    }
    const thickness = width <= 600 ? 8 : 16;
    await expect(palette).toHaveCSS('column-gap', `${thickness}px`);
    const expectEqualSpacing = async () => {
      const bounds = await page.locator('.swatch, .empty-swatch').evaluateAll(elements => elements.map(element => {
        const { left, right, top, bottom, width } = element.getBoundingClientRect();
        return { left, right, top, bottom, width };
      }));
      const columns = bounds.filter(cell => Math.abs(cell.top - bounds[0].top) < 1).length;
      const gaps = [bounds[0].left, width - bounds[bounds.length - 1].right, bounds[0].top, 900 - bounds[bounds.length - 1].bottom,
        ...bounds.flatMap((cell, index, all) => [
          ...(index % columns > 0 ? [cell.left - all[index - 1].right] : []),
          ...(index >= columns ? [cell.top - all[index - columns].bottom] : []),
        ])];
      for (const gap of gaps) expect(gap).toBeCloseTo(thickness, 1);
      for (const swatch of bounds) expect(swatch.width).toBeCloseTo(bounds[0].width, 1);
    };
    await expectEqualSpacing();
    await page.getByRole('button', { name: 'Add color at position 3', exact: true }).click();
    await expect(page.locator('.swatch')).toHaveCount(6);
    await expectEqualSpacing();
    const selected = page.getByRole('region', { name: 'Color 2', exact: true });
    await selected.click({ position: { x: await selected.evaluate(element => element.getBoundingClientRect().width / 2), y: 200 } });
    await page.keyboard.press('Control+ArrowRight');
    await page.locator('.swatch').evaluateAll(elements => Promise.all(elements.flatMap(element => element.getAnimations().map(animation => animation.finished))));
    await expectEqualSpacing();
    await page.keyboard.press('Delete');
    await expect(page.locator('.swatch')).toHaveCount(5);
    await expectEqualSpacing();
    await page.locator('.outline-zone-top-right button').click();
    await page.clock.runFor(400);
    await expect(palette).toHaveCSS('background-color', 'rgb(0, 0, 0)');
    await expectEqualSpacing();
  });
}

test('outline edges, gaps, and ink drops transition together between white and black', async ({ page }) => {
  const palette = page.getByRole('main');
  for (const mode of ['outer', 'swatches']) {
    await page.keyboard.press('Control+Space');
    await page.clock.runFor(400);
    await expect(palette).toHaveAttribute('data-outline', mode);
    for (const color of ['rgb(0, 0, 0)', 'rgb(255, 255, 255)']) {
      await page.locator('.outline-zone-top-right button').click();
      await page.clock.runFor(200);
      const animations = await palette.evaluate(element => [element, ...element.querySelectorAll('.outline-ink')].flatMap(target => target.getAnimations()).filter(animation =>
        animation instanceof CSSTransition && ['background-color', 'border-top-color', 'fill'].includes(animation.transitionProperty)
      ).map(animation => { animation.pause(); animation.currentTime = 175; return animation; }).length);
      expect(animations).toBe(4);
      const colors = await palette.evaluate(element => {
        const style = getComputedStyle(element);
        return [style.borderTopColor, style.backgroundColor, ...Array.from(element.querySelectorAll('.outline-ink'), ink => getComputedStyle(ink).fill)];
      });
      for (const color of colors) expect(color).toBe(colors[0]);
      expect(colors[0]).not.toBe('rgb(0, 0, 0)');
      expect(colors[0]).not.toBe('rgb(255, 255, 255)');
      await palette.evaluate(element => element.getAnimations({ subtree: true }).forEach(animation => animation.finish()));
      await expect(palette).toHaveCSS('border-top-color', color);
      await expect(palette).toHaveCSS('background-color', color);
      for (const ink of await page.locator('.outline-ink').all()) await expect(ink).toHaveCSS('fill', color);
    }
  }
});

test('rapid outline presses each cycle the mode without changing color', async ({ page }) => {
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  const palette = page.getByRole('main');
  for (const mode of ['outer', 'swatches', 'none', 'outer']) {
    await page.keyboard.press('Control+Space');
    await expect(palette).toHaveAttribute('data-outline', mode);
    await expect(palette).toHaveCSS('--outline-color', 'white');
  }
});

test('outline mode and color survive reloads and reopening with a different palette', async ({ page, context }) => {
  const palette = page.getByRole('main');
  await page.keyboard.press('Control+Shift+Space');
  for (const mode of ['outer', 'swatches', 'none']) {
    await page.reload();
    await expect(palette).toHaveAttribute('data-outline', mode);
    await expect(palette).toHaveCSS('--outline-color', 'black');
    if (mode !== 'none') await page.keyboard.press('Control+Space');
  }
  await page.keyboard.press('Control+Space');
  await page.keyboard.press('Control+Shift+Space');
  const reopened = await context.newPage();
  await reopened.goto('/#ABC123#123ABC');
  await expect(reopened.getByRole('main')).toHaveAttribute('data-outline', 'outer');
  await expect(reopened.getByRole('main')).toHaveCSS('--outline-color', 'white');
  await expect(reopened.locator('.hex-button')).toHaveText(['ABC123', '123ABC']);
  await reopened.close();
});

test('invalid saved outline preferences fall back to the default', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('palette:outline', 'invalid:invalid'));
  await page.reload();
  await expect(page.getByRole('main')).toHaveAttribute('data-outline', 'none');
  await expect(page.getByRole('main')).toHaveCSS('--outline-color', 'white');
});

test('outline controls remain usable when localStorage is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() { throw new DOMException('Storage blocked', 'SecurityError'); },
    });
  });
  await page.reload();
  const palette = page.getByRole('main');
  await expect(palette).toHaveAttribute('data-outline', 'none');
  await page.keyboard.press('Control+Space');
  await expect(palette).toHaveAttribute('data-outline', 'outer');
  await page.keyboard.press('Control+Shift+Space');
  await expect(palette).toHaveCSS('--outline-color', 'black');
  await page.keyboard.press('Control+Space');
  await expect(palette).toHaveAttribute('data-outline', 'swatches');
});
