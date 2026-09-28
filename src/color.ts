import Color from 'colorjs.io';

export const modes = ['HSB', 'HSL', 'RGB', 'CMYK', 'LAB'] as const;
export type Mode = typeof modes[number];
export type Channel = Readonly<{ label: string; min: number; max: number; unit: string }>;
const channel = (label: string, max = 100, unit = '%', min = 0): Channel => ({ label, min, max, unit });
export const channels: Readonly<Record<Mode, readonly Channel[]>> = {
  HSB: [channel('Hue', 360, '°'), channel('Saturation'), channel('Brightness')],
  HSL: [channel('Hue', 360, '°'), channel('Saturation'), channel('Lightness')],
  RGB: [channel('Red', 255, ''), channel('Green', 255, ''), channel('Blue', 255, '')],
  CMYK: [channel('Cyan'), channel('Magenta'), channel('Yellow'), channel('Black')],
  LAB: [channel('Lightness', 100, ''), channel('a', 127, '', -128), channel('b', 127, '', -128)],
};
const spaces = { HSB: 'hsv', HSL: 'hsl', RGB: 'srgb', LAB: 'lab' } as const;
export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export function parseHex(text: string): string | undefined {
  const match = /^#?([\da-f]{6}|[\da-f]{3})$/i.exec(text.trim());
  if (!match) return;
  const hex = match[1].toUpperCase();
  return hex.length === 3 ? [...hex].map(character => character.repeat(2)).join('') : hex;
}

export function coordinates(hex: string, mode: Mode): readonly number[] {
  const color = new Color(`#${hex}`);
  if (mode === 'CMYK') {
    const rgb = color.to('srgb').coords.map(value => value ?? 0);
    const peak = Math.max(...rgb);
    return [...rgb.map(value => peak === 0 ? 0 : (1 - value / peak) * 100), (1 - peak) * 100];
  }
  return color.to(spaces[mode]).coords.map(value => value !== null && Number.isFinite(value) ? value * (mode === 'RGB' ? 255 : 1) : 0);
}

export function toHex(mode: Mode, values: readonly number[]): string {
  const rgb = mode === 'CMYK'
    ? values.slice(0, 3).map(value => (1 - value / 100) * (1 - values[3] / 100))
    : new Color(spaces[mode], mode === 'RGB' ? [values[0] / 255, values[1] / 255, values[2] / 255] : [values[0], values[1], values[2]]).to('srgb').coords;
  // The palette and URL are sRGB; clip out-of-gamut LAB coordinates consistently in every preview.
  return rgb.map(value => Math.round(clamp(value ?? 0) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function ink(hex: string): '#000000' | '#ffffff' {
  const rgb = coordinates(hex, 'RGB').map(value => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722 > .179 ? '#000000' : '#ffffff';
}

export const replace = (values: readonly number[], index: number, value: number) => values.map((v, i) => i === index ? value : v);
export const fraction = (value: number, c: Channel) => clamp((value - c.min) / (c.max - c.min));
export const atFraction = (t: number, c: Channel) => c.min + clamp(t) * (c.max - c.min);
export const modeCode = (mode: Mode, values: readonly number[]) => `${mode} ${values.map((value, i) => `${Math.round(value)}${channels[mode][i].unit}`).join(' ')}`;

export function shades(mode: Mode, values: readonly number[], index: number) {
  const c = channels[mode][index];
  const original = Math.round(fraction(values[index], c) * 24);
  return Array.from({ length: 25 }, (_, i) => {
    const coords = replace(values, index, i === original ? values[index] : atFraction(i / 24, c));
    return { hex: toHex(mode, coords), code: modeCode(mode, coords), original: i === original };
  });
}
