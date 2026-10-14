import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { loadColorCatalog, searchCatalog } from './color-catalog';

const colors = [{ name: 'Night Sky', colorNumber: '0001', rgb: 0x001122, colorFamilyNames: ['Blue'] }];
const key = 'palette-sherwin-williams';
const day = 86_400_000;
const storage = new Map<string, string>();
const request = vi.fn();
const load = () => loadColorCatalog(new AbortController().signal);
const searchNames = (names: readonly string[], query: string) => searchCatalog(
  names.map((name, index) => ({ name, colorNumber: String(index), rgb: 0, colorFamilyNames: [] })), query,
).map(color => color.name);

it('ranks unordered terms by their best word offsets, then name-word order', () => {
  const names = ['Offwhite Darkkestrel', 'White Darkkestrel', 'Offwhite Kestrel', 'Kestrel Offwhite', 'Kestrel White', 'White'];
  const expected = ['Kestrel White', 'Kestrel Offwhite', 'Offwhite Kestrel', 'White Darkkestrel', 'Offwhite Darkkestrel'];
  expect(searchNames(names, 'white kestrel')).toEqual(expected);
  expect(searchNames(names, 'kestrel white')).toEqual(expected);
  expect(searchNames(names, '  WHITE\t kestrel  ')).toEqual(expected);
});

it('compares every ranked offset before using the name-word tiebreaker', () => {
  expect(searchNames(['Xred Xblue Xgreen', 'Red Xblue XXgreen', 'Red Xblue Xgreen'], 'green red blue')).toEqual([
    'Red Xblue Xgreen', 'Red Xblue XXgreen', 'Xred Xblue Xgreen',
  ]);
  expect(searchNames(['Xred Blue', 'Red Xblue'], 'red blue')).toEqual(['Red Xblue', 'Xred Blue']);
});

it('prefers earlier offsets within words, then earlier matching words', () => {
  expect(searchNames(['Offwhite', 'Snow White', 'White Snow', 'Snow Offwhite'], 'white')).toEqual([
    'White Snow', 'Snow White', 'Offwhite', 'Snow Offwhite',
  ]);
});

it('uses the best occurrence and preserves catalog order on a complete tie', () => {
  expect(searchNames(['Offwhite White', 'White Offwhite', 'Kestrel White', 'Blue White'], 'white')).toEqual([
    'White Offwhite', 'Offwhite White', 'Kestrel White', 'Blue White',
  ]);
});

it('requires every term, handles empty searches, and leaves the catalog untouched', () => {
  const catalog = Object.freeze(colors.map(color => Object.freeze(color)));
  expect(searchCatalog(catalog, 'sky night').map(color => color.name)).toEqual(['Night Sky']);
  expect(searchCatalog(catalog, 'sky white')).toEqual([]);
  expect(searchCatalog(catalog, '  ')).toEqual(colors);
  expect(catalog).toEqual(colors);
});

beforeEach(() => {
  storage.clear();
  request.mockReset().mockImplementation(async () => Response.json(colors));
  vi.stubGlobal('fetch', request);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('downloads once and reuses a timestamped cache until it reaches one day old', async () => {
  expect(await load()).toEqual(colors);
  expect(request).toHaveBeenCalledTimes(1);
  const timestamp = Date.now();
  expect(JSON.parse(storage.get(key)!)).toEqual({ timestamp, colors });
  vi.mocked(Date.now).mockReturnValue(timestamp + day - 1);
  expect(await load()).toEqual(colors);
  expect(request).toHaveBeenCalledTimes(1);
  vi.mocked(Date.now).mockReturnValue(timestamp + day);
  const updated = [{ ...colors[0], name: 'New Sky' }];
  request.mockImplementation(async () => Response.json(updated));
  expect(await load()).toEqual(updated);
  expect(request).toHaveBeenCalledTimes(2);
  expect(request.mock.calls[1][1].cache).toBe('no-cache');
  expect(JSON.parse(storage.get(key)!).timestamp).toBe(timestamp + day);
});

it('keeps expired data available when refresh fails without extending its lifetime', async () => {
  const cached = JSON.stringify({ timestamp: Date.now() - day, colors });
  storage.set(key, cached);
  request.mockRejectedValue(new TypeError('Offline'));
  expect(await load()).toEqual(colors);
  expect(storage.get(key)).toBe(cached);
  expect(await load()).toEqual(colors);
  expect(request).toHaveBeenCalledTimes(2);
});

it.each(['not json', JSON.stringify({ timestamp: 1, colors: [{}] }), JSON.stringify({ timestamp: 1_900_000_000_000, colors })])('refetches invalid or future-dated cache %s', async cached => {
  storage.set(key, cached);
  expect(await load()).toEqual(colors);
  expect(request).toHaveBeenCalledTimes(1);
});

it('handles missing families and untranslated family keys without losing searchable colors', async () => {
  request.mockImplementation(async () => Response.json([
    { name: 'Bison', colorNumber: '1084', rgb: 0x123456 },
    { ...colors[0], colorFamilyNames: ['SW0001_COLOR_FAMILY_NAME', 'Blue'], base64Image: 'unused' },
  ]));
  expect(await load()).toEqual([
    { name: 'Bison', colorNumber: '1084', rgb: 0x123456, colorFamilyNames: [] }, colors[0],
  ]);
  expect(storage.get(key)).not.toContain('base64Image');
});

it('still loads when localStorage is blocked', async () => {
  vi.stubGlobal('localStorage', {
    getItem: () => { throw new Error('Blocked'); },
    setItem: () => { throw new Error('Blocked'); },
  });
  expect(await load()).toEqual(colors);
});

it.each([503, 200])('does not cache an unsuccessful or malformed response (%s)', async status => {
  request.mockImplementation(async () => Response.json({ error: 'Unavailable' }, { status }));
  await expect(load()).rejects.toThrow();
  expect(storage.has(key)).toBe(false);
});

it('propagates cancellation instead of returning expired data', async () => {
  storage.set(key, JSON.stringify({ timestamp: Date.now() - day, colors }));
  const controller = new AbortController();
  controller.abort();
  request.mockRejectedValue(new DOMException('Aborted', 'AbortError'));
  await expect(loadColorCatalog(controller.signal)).rejects.toHaveProperty('name', 'AbortError');
});
