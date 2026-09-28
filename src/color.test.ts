import { describe, expect, it } from 'vitest';
import { colorInfo, coordinates, ink, modes, parseHex, shades, toHex } from './color';
import { historyReducer, insertionColor, move, parse, serialize } from './palette';

describe('color conversion', () => {
  it('accepts clipboard hex with optional hash, whitespace, and shorthand', () => {
    expect(parseHex(' #abc123\n')).toBe('ABC123');
    expect(parseHex('def')).toBe('DDEEFF');
    expect(parseHex('red')).toBeUndefined();
    expect(parseHex('#12345678')).toBeUndefined();
  });
  for (const mode of modes) {
    it(`round trips sRGB through ${mode}, including achromatic colors`, () => {
      for (const hex of ['000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', '808080', '264653', 'E9C46A']) {
        expect(toHex(mode, coordinates(hex, mode))).toBe(hex);
      }
    });
  }
  it('matches reference primary colors', () => {
    expect(coordinates('FF0000', 'RGB')).toEqual([255, 0, 0]);
    expect(coordinates('FF0000', 'CMYK')).toEqual([0, 100, 100, 0]);
    expect(coordinates('FF0000', 'LAB')[0]).toBeCloseTo(54.29, 1);
    expect(toHex('HSB', [120, 100, 100])).toBe('00FF00');
    expect(toHex('HSL', [240, 100, 50])).toBe('0000FF');
  });
  it('produces 25 shades with exactly one unchanged original', () => {
    const result = shades('HSB', coordinates('2A9D8F', 'HSB'), 2);
    expect(result).toHaveLength(25);
    expect(result.filter(item => item.original).map(item => item.hex)).toEqual(['2A9D8F']);
    expect(result[0].hex).toBe('000000');
  });
  it('selects readable black or white text', () => {
    expect(ink('FFFFFF')).toBe('#000000');
    expect(ink('000000')).toBe('#ffffff');
    expect(ink('E9C46A')).toBe('#000000');
  });
});

describe('color information', () => {
  it('reports reference values and contrast for primary colors', () => {
    expect(Object.fromEntries(colorInfo('FF0000'))).toMatchObject({
      RGB: '255 0 0', HSL: '0° 100% 50%', HSB: '0° 100% 100%',
      'CMYK (approx.)': '0% 100% 100% 0%', 'Lab (D50)': '54.3 80.8 69.9',
      'Relative luminance': '0.2126',
      'Black text · WCAG 2.2': '5.25:1 · AA', 'White text · WCAG 2.2': '3.99:1 · AA large only',
    });
  });
  it('marks achromatic hues as undefined and gives the black/white contrast endpoints', () => {
    const black = Object.fromEntries(colorInfo('000000'));
    const white = Object.fromEntries(colorInfo('FFFFFF'));
    expect(black.HSL).toBe('— 0% 0%');
    expect(white.HSB).toBe('— 0% 100%');
    expect(black.OKLCH).toBe('0% 0 —');
    expect(white.OKLCH).toBe('100% 0 —');
    expect(black['Black text · WCAG 2.2']).toBe('1.00:1 · Fail');
    expect(black['White text · WCAG 2.2']).toBe('21.00:1 · AAA');
    expect(white['Black text · WCAG 2.2']).toBe('21.00:1 · AAA');
    for (const hex of ['000000', 'FFFFFF', '808080']) {
      expect(colorInfo(hex).flat().join(' ')).not.toMatch(/NaN|Infinity|-0(?:\s|$)/);
    }
  });
  it('distinguishes colors on opposite sides of the AA normal-text threshold', () => {
    expect(Object.fromEntries(colorInfo('767676'))['White text · WCAG 2.2']).toBe('4.54:1 · AA');
    expect(Object.fromEntries(colorInfo('777777'))['White text · WCAG 2.2']).toBe('4.47:1 · AA large only');
  });
});

describe('palette editing', () => {
  const palette = parse('#ABC123#123ABC#ABABAB#121212');
  it('preserves URL order and uses simple numbered names', () => {
    expect(serialize(palette)).toBe('#ABC123#123ABC#ABABAB#121212');
    expect(palette.map(item => item.name)).toEqual(['Color 1', 'Color 2', 'Color 3', 'Color 4']);
    expect(parse('#not-a-color')).toHaveLength(5);
  });
  it('inserts a swatch at its destination while preserving intervening order and identity', () => {
    const next = move(palette, palette[0].id, 2);
    expect(next).toEqual([palette[1], palette[2], palette[0], palette[3]]);
    expect(move(palette, palette[3].id, 0)).toEqual([palette[3], palette[0], palette[1], palette[2]]);
    expect(move(palette, palette[0].id, 99)).toEqual([palette[1], palette[2], palette[3], palette[0]]);
    expect(move(palette, palette[0].id, -1)).toBe(palette);
    expect(palette[0].hex).toBe('ABC123');
  });
  it('shares custom names and safely encodes URL delimiters and Unicode', () => {
    const named = parse('#ABABAB:Meadow#121212#CDCDCD:Evening');
    expect(named.map(swatch => swatch.name)).toEqual(['Meadow', 'Color 2', 'Evening']);
    expect(serialize(named)).toBe('#ABABAB:Meadow#121212#CDCDCD:Evening');
    const custom = [{ ...named[0], name: 'Sky #1: café / 雨 100%' }];
    expect(parse(serialize(custom))[0].name).toBe(custom[0].name);
    expect(parse('#ABABAB:%invalid')[0].name).toBe('Color 1');
  });
  it('undoes, redoes, and discards the redo branch after another edit', () => {
    const initial = { past: [], present: palette, future: [] };
    const next = move(palette, palette[0].id, 2);
    const committed = historyReducer(initial, { type: 'commit', palette: next });
    const undone = historyReducer(committed, { type: 'undo' });
    expect(undone.present).toEqual(palette);
    expect(historyReducer(undone, { type: 'redo' }).present).toEqual(next);
    expect(historyReducer(undone, { type: 'commit', palette: palette.slice(1) }).future).toEqual([]);
  });
});

describe('new palette colors', () => {
  it('blends the two neighbors at an interior position', () => {
    const palette = parse('#000000#406080#6080A0#FFFFFF');
    expect(insertionColor(palette, 2)).toBe('507090');
  });
  it('extends the color difference outward at both edges', () => {
    const palette = parse('#406080#6080A0');
    expect(insertionColor(palette, 0)).toBe('204060');
    expect(insertionColor(palette, 2)).toBe('80A0C0');
  });
  it('clips extrapolated channels to the sRGB range', () => {
    const palette = parse('#10F080#F01040');
    expect(insertionColor(palette, 0)).toBe('00FFC0');
    expect(insertionColor(palette, 2)).toBe('FF0000');
  });
  it('repeats the available color when there is only one swatch', () => {
    const palette = parse('#2A9D8F');
    expect(insertionColor(palette, 0)).toBe('2A9D8F');
    expect(insertionColor(palette, 1)).toBe('2A9D8F');
  });
});
