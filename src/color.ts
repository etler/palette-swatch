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

function relativeLuminance(hex: string): number {
  const rgb = coordinates(hex, 'RGB').map(value => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}

export function contrastRatio(first: string, second: string): number {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

export const contrastRating = (ratio: number) => ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA large only' : 'Fail';

export const visionModes = ['Normal', 'Protanopia', 'Deuteranopia', 'Tritanopia', 'Grayscale'] as const;
export type VisionMode = typeof visionModes[number];

// Machado et al. (2009), severity 1.0, applied in linear RGB.
// https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html
const visionMatrices = {
  Protanopia: [[.152286, 1.052583, -.204868], [.114503, .786281, .099216], [-.003882, -.048116, 1.051998]],
  Deuteranopia: [[.367322, .860646, -.227968], [.280085, .672501, .047413], [-.011820, .042940, .968881]],
  Tritanopia: [[1.255528, -.076749, -.178779], [-.078411, .930809, .147602], [.004733, .691367, .303900]],
  Grayscale: [[.2126, .7152, .0722], [.2126, .7152, .0722], [.2126, .7152, .0722]],
} as const;

export function simulateVision(hex: string, mode: VisionMode): string {
  if (mode === 'Normal') return hex;
  const rgb = new Color(`#${hex}`).to('srgb-linear').coords;
  const [r, g, b] = visionMatrices[mode].map(row => clamp(row.reduce((sum, weight, index) => sum + weight * (rgb[index] ?? 0), 0)));
  const simulated = new Color('srgb-linear', [r, g, b]).to('srgb');
  return toHex('RGB', simulated.coords.map(value => (value ?? 0) * 255));
}

export function ink(hex: string): '#000000' | '#ffffff' {
  return relativeLuminance(hex) > .179 ? '#000000' : '#ffffff';
}

export function colorInfo(hex: string): readonly (readonly [string, string])[] {
  const rgb = coordinates(hex, 'RGB');
  const neutral = rgb.every(value => value === rgb[0]);
  const format = (value: number, digits = 1) => String(Number(value.toFixed(digits)));
  const hue = (value: number) => neutral ? '—' : `${format(value)}°`;
  const cylindrical = (mode: 'HSL' | 'HSB') => {
    const [h, s, l] = coordinates(hex, mode);
    return `${hue(h)} ${format(s)}% ${format(l)}%`;
  };
  const [lightness, chroma, angle] = new Color(`#${hex}`).to('oklch').coords;
  const luminance = relativeLuminance(hex);
  const contrast = (ratio: number) => {
    return `${(Math.floor(ratio * 100) / 100).toFixed(2)}:1 · ${contrastRating(ratio)}`;
  };
  return [
    ['RGB', rgb.map(value => format(value, 0)).join(' ')],
    ['HSL', cylindrical('HSL')],
    ['HSB', cylindrical('HSB')],
    ['CMYK (approx.)', coordinates(hex, 'CMYK').map(value => `${format(value)}%`).join(' ')],
    ['Lab (D50)', coordinates(hex, 'LAB').map(value => format(value)).join(' ')],
    ['OKLCH', `${format((lightness ?? 0) * 100)}% ${format(chroma ?? 0, 4)} ${hue(angle ?? 0)}`],
    ['Relative luminance', format(luminance, 4)],
    ['Black text · WCAG 2.2', contrast((luminance + .05) / .05)],
    ['White text · WCAG 2.2', contrast(1.05 / (luminance + .05))],
  ];
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
