import { clamp, coordinates, toHex } from './color';

export type Swatch = Readonly<{ id: string; hex: string; name: string }>;
export type Palette = readonly Swatch[];
export type History = Readonly<{ past: readonly Palette[]; present: Palette; future: readonly Palette[] }>;
export type Action = Readonly<{ type: 'commit'; palette: Palette }> | Readonly<{ type: 'undo' | 'redo' }>;
export const defaults = ['264653', '2A9D8F', 'E9C46A', 'F4A261', 'E76F51'];
export const serialize = (palette: Palette) => palette.map(swatch => `#${swatch.hex}${swatch.name ? `:${encodeURIComponent(swatch.name)}` : ''}`).join('');

export function parse(hash: string): Palette {
  const parts = hash.split('#').filter(Boolean);
  const colors = parts.length && parts.every(value => /^[\da-f]{6}(?::.*)?$/i.test(value)) ? parts : defaults;
  return colors.map(value => {
    const hex = value.slice(0, 6).toUpperCase();
    try {
      return { id: crypto.randomUUID(), hex, name: decodeURIComponent(value.slice(7)).trim() };
    } catch { return { id: crypto.randomUUID(), hex, name: '' }; }
  });
}

export function historyReducer(history: History, action: Action): History {
  if (action.type === 'commit') {
    if (JSON.stringify(action.palette) === JSON.stringify(history.present)) return history;
    return { past: [...history.past, history.present].slice(-100), present: action.palette, future: [] };
  }
  if (action.type === 'undo') {
    const previous = history.past.at(-1);
    return previous ? { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] } : history;
  }
  const next = history.future[0];
  return next ? { past: [...history.past, history.present], present: next, future: history.future.slice(1) } : history;
}

export function move(palette: Palette, id: string, target: number): Palette {
  const origin = palette.findIndex(swatch => swatch.id === id);
  if (origin < 0) return palette;
  const position = Math.min(palette.length - 1, Math.max(0, target));
  if (position === origin) return palette;
  const remaining = palette.filter((_, index) => index !== origin);
  return [...remaining.slice(0, position), palette[origin], ...remaining.slice(position)];
}

export function insertionColor(palette: Palette, position: number): string {
  const index = clamp(position - 1, 0, Math.max(0, palette.length - 2));
  const left = coordinates(palette[index].hex, 'RGB');
  const right = coordinates(palette[Math.min(index + 1, palette.length - 1)].hex, 'RGB');
  const amount = position === 0 ? -1 : position === palette.length ? 2 : .5;
  return toHex('RGB', left.map((value, channel) => value + (right[channel] - value) * amount));
}

export function persist(palette: Palette) {
  const hash = serialize(palette);
  if (location.hash !== hash) window.history.replaceState(null, '', `${location.pathname}${location.search}${hash}`);
}
