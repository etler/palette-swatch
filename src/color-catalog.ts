export type CatalogColor = Readonly<{
  name: string;
  colorNumber: string;
  rgb: number;
  colorFamilyNames: readonly string[];
}>;

const endpoint = 'https://www.sherwin-williams.com/color-visualization/services/color/SW/all';
const storageKey = 'palette-sherwin-williams';
const day = 24 * 60 * 60 * 1000;

export function searchCatalog(colors: readonly CatalogColor[], query: string): readonly CatalogColor[] {
  const terms = query.toLowerCase().match(/\S+/g) ?? [];
  if (terms.length === 0) return colors;
  return colors.flatMap(color => {
    const positions = color.name.toLowerCase().split(/\s+/).map(word => terms.map(term => {
      const index = word.indexOf(term);
      return index < 0 ? Infinity : index;
    }));
    const best = terms.map((_, index) => Math.min(...positions.map(word => word[index])));
    if (best.some(position => !Number.isFinite(position))) return [];
    // Rank each term's best match first, then each name word's best match in reading order.
    const score = [...best.sort((a, b) => a - b), ...positions.map(word => Math.min(...word))];
    return [{ color, score }];
  }).sort((a, b) => {
    for (const index of Array.from({ length: Math.max(a.score.length, b.score.length) }, (_, index) => index)) {
      const left = a.score[index] ?? Infinity;
      const right = b.score[index] ?? Infinity;
      if (left !== right) return left - right;
    }
    return 0;
  }).map(({ color }) => color);
}

function parseCatalog(value: unknown): readonly CatalogColor[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('Invalid color catalog');
  return value.map(color => {
    const families: unknown = color?.colorFamilyNames ?? [];
    if (!color || typeof color.name !== 'string' || typeof color.colorNumber !== 'string' ||
      !Number.isInteger(color.rgb) || color.rgb < 0 || color.rgb > 0xFFFFFF ||
      !Array.isArray(families) || !families.every((name: unknown) => typeof name === 'string')) throw new Error('Invalid color catalog');
    return {
      name: color.name, colorNumber: color.colorNumber, rgb: color.rgb,
      // Archived colors sometimes carry untranslated family keys instead of names.
      colorFamilyNames: families.filter(name => !/^SW\d+_COLOR_FAMILY_NAME$/.test(name)),
    };
  });
}

function readCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    if (cached && Number.isFinite(cached.timestamp)) {
      return { timestamp: Number(cached.timestamp), colors: parseCatalog(cached.colors) };
    }
  } catch { /* Unavailable storage or invalid JSON is a cache miss. */ }
}

export async function loadColorCatalog(signal: AbortSignal): Promise<readonly CatalogColor[]> {
  const cached = readCache();
  const age = cached ? Date.now() - cached.timestamp : Infinity;
  if (cached && age >= 0 && age < day) return cached.colors;
  try {
    const response = await fetch(endpoint, { cache: 'no-cache', signal });
    if (!response.ok) throw new Error('Color catalog unavailable');
    const colors = parseCatalog(await response.json());
    try {
      localStorage.setItem(storageKey, JSON.stringify({ timestamp: Date.now(), colors }));
    } catch { /* Search remains available when storage is blocked or full. */ }
    return colors;
  } catch (error) {
    if (cached && !signal.aborted) return cached.colors;
    throw error;
  }
}
