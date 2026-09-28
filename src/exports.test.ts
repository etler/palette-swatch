import { describe, expect, it } from 'vitest';
import { exportFormats } from './palette-exports';
import { parse } from './palette';

const palette = parse('#000000:Night#FFFFFF#2A9D8F:Ocean#ABC123:Ocean');
const file = async (filename: string, colors = palette) => {
  const format = exportFormats.find(item => item.filename === filename);
  if (!format) throw new Error(`Unknown format: ${filename}`);
  return format.create(colors);
};

describe('palette export files', () => {
  it('preserves names, unnamed colors, duplicates, and order in JSON without internal IDs', async () => {
    expect(JSON.parse(await (await file('palette.json')).text())).toEqual([
      { hex: '#000000', name: 'Night' }, { hex: '#FFFFFF', name: '' },
      { hex: '#2A9D8F', name: 'Ocean' }, { hex: '#ABC123', name: 'Ocean' },
    ]);
  });

  it('generates valid, unique CSS/Tailwind identifiers for arbitrary names', async () => {
    const colors = parse('#000000:Ocean#FFFFFF:Ocean#2A9D8F#ABC123:%22%3B%7D%20%40import%20url(x)');
    expect(await (await file('palette.css', colors)).text()).toBe(':root {\n  --swatch-1-ocean: #000000;\n  --swatch-2-ocean: #FFFFFF;\n  --swatch-3: #2A9D8F;\n  --swatch-4-import-url-x: #ABC123;\n}\n');
    expect(await (await file('palette.tailwind.css', colors)).text()).toBe('@theme {\n  --color-swatch-1-ocean: #000000;\n  --color-swatch-2-ocean: #FFFFFF;\n  --color-swatch-3: #2A9D8F;\n  --color-swatch-4-import-url-x: #ABC123;\n}\n');
  });

  it('quotes CSV names and prevents spreadsheet formulas from being interpreted', async () => {
    const colors = [{ id: '1', hex: 'ABC123', name: 'Sky, "blue"\n晴' }, { id: '2', hex: 'FFFFFF', name: '=1+1' }];
    expect(await (await file('palette.csv', colors)).text()).toBe('hex,name\r\n"#ABC123","Sky, ""blue""\n晴"\r\n"#FFFFFF","\'=1+1"\r\n');
  });

  it('writes plain text and GIMP palettes without inventing names', async () => {
    expect(await (await file('palette.txt')).text()).toBe('#000000\tNight\n#FFFFFF\n#2A9D8F\tOcean\n#ABC123\tOcean\n');
    expect(await (await file('palette.gpl')).text()).toBe('GIMP Palette\nName: Palette\nColumns: 0\n#\n0 0 0\tNight\n255 255 255\n42 157 143\tOcean\n171 193 35\tOcean\n');
  });

  it('encodes ASE version 1 with UTF-16BE names, RGB floats, and normal colors', async () => {
    const colors = parse('#000000:%E9%9B%A8%20%F0%9F%8E%A8#FFFFFF#2A9D8F:Ocean');
    const bytes = await (await file('palette.ase', colors)).arrayBuffer();
    const data = new DataView(bytes);
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('ASEF');
    expect([data.getUint16(4), data.getUint16(6), data.getUint32(8)]).toEqual([1, 0, 3]);
    let offset = 12;
    const decoded = colors.map(() => {
      expect(data.getUint16(offset)).toBe(1);
      const end = offset + 6 + data.getUint32(offset + 2);
      offset += 6;
      const length = data.getUint16(offset);
      offset += 2;
      const name = new TextDecoder('utf-16be').decode(bytes.slice(offset, offset + (length - 1) * 2));
      expect(data.getUint16(offset + (length - 1) * 2)).toBe(0);
      offset += length * 2;
      expect(new TextDecoder().decode(bytes.slice(offset, offset + 4))).toBe('RGB ');
      offset += 4;
      const rgb = Array.from({ length: 3 }, (_, i) => Math.round(data.getFloat32(offset + i * 4) * 255));
      offset += 12;
      expect(data.getUint16(offset)).toBe(2);
      offset += 2;
      expect(offset).toBe(end);
      return { name, rgb };
    });
    expect(decoded).toEqual([{ name: '雨 🎨', rgb: [0, 0, 0] }, { name: '', rgb: [255, 255, 255] }, { name: 'Ocean', rgb: [42, 157, 143] }]);
    expect(offset).toBe(bytes.byteLength);
  });

  it('escapes XML markup and excludes invalid XML control characters', async () => {
    const colors = [{ id: '1', hex: 'ABC123', name: '<script>& "雨"\0' }];
    const text = await (await file('palette.svg', colors)).text();
    expect(text).toContain('&lt;script&gt;&amp; &quot;雨&quot;');
    expect(text).not.toContain('<script>');
    expect(text).not.toContain('\0');
    expect(text).toContain('width="240" height="320"');
    expect(text).toContain('fill="#ABC123"');
  });
});
