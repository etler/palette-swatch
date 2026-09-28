import { ink } from './color';
import type { Palette } from './palette';

const textFile = (text: string, type = 'text/plain') => new Blob([text], { type: `${type};charset=utf-8` });
const rgb = (hex: string) => [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
const lineName = (name: string) => name.replace(/\s+/g, ' ').trim();
const identifier = (name: string, index: number) => {
  const slug = name.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `swatch-${index + 1}${slug ? `-${slug}` : ''}`;
};
const xml = (text: string) => text.replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const csv = (text: string) => `"${(/^[\s]*[=+@-]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`;

function svg(palette: Palette): Blob {
  const columns = Math.min(5, palette.length);
  const width = columns * 240;
  const height = Math.ceil(palette.length / columns) * 320;
  return textFile(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<title>Color palette</title>
${palette.map(({ hex, name }, index) => {
    const letters = [...lineName(name)];
    const lines = Array.from({ length: Math.min(4, Math.ceil(letters.length / 16)) }, (_, line) =>
      `${letters.slice(line * 16, (line + 1) * 16).join('')}${line === 3 && letters.length > 64 ? '…' : ''}`);
    return `<g transform="translate(${index % columns * 240} ${Math.floor(index / columns) * 320})">
<title>${xml(name ? `${name} — #${hex}` : `#${hex}`)}</title>
<rect width="240" height="320" fill="#${hex}"/>
<g fill="${ink(hex)}" font-family="sans-serif" text-anchor="middle">
<text x="120" y="205" font-size="26" font-weight="600">${hex}</text>
${lines.map((line, i) => `<text x="120" y="${233 + i * 18}" font-size="13">${xml(line)}</text>`).join('\n')}
</g></g>`;
  }).join('\n')}
</svg>\n`, 'image/svg+xml');
}

async function png(palette: Palette): Promise<Blob> {
  const url = URL.createObjectURL(svg(palette));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    const scale = Math.min(2, 8192 / image.width, 8192 / image.height, Math.sqrt(16_000_000 / (image.width * image.height)));
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image export unavailable.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Image export unavailable.'));
    }, 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

function ase(palette: Palette): Blob {
  const header = new DataView(new ArrayBuffer(12));
  header.setUint32(0, 0x41534546); // ASEF, version 1.0; integers and floats are big-endian.
  header.setUint16(4, 1);
  header.setUint32(8, palette.length);
  const blocks = palette.map(swatch => {
    const name = swatch.name.replace(/\0/g, '').slice(0, 65534).replace(/[\uD800-\uDBFF]$/, '');
    const nameBytes = (name.length + 1) * 2;
    const block = new DataView(new ArrayBuffer(26 + nameBytes));
    block.setUint16(0, 1);
    block.setUint32(2, block.byteLength - 6);
    block.setUint16(6, name.length + 1);
    name.split('').forEach((unit, i) => block.setUint16(8 + i * 2, unit.charCodeAt(0)));
    block.setUint32(8 + nameBytes, 0x52474220); // RGB color model.
    rgb(swatch.hex).forEach((value, i) => block.setFloat32(12 + nameBytes + i * 4, value / 255));
    block.setUint16(24 + nameBytes, 2); // Normal (non-spot) color.
    return block.buffer;
  });
  return new Blob([header.buffer, ...blocks], { type: 'application/octet-stream' });
}

export const exportFormats = [
  { label: 'CSS', action: 'copy', filename: 'palette.css', create: (palette: Palette) => textFile(`:root {\n${palette.map(({ hex, name }, index) => `  --${identifier(name, index)}: #${hex};`).join('\n')}\n}\n`, 'text/css') },
  { label: 'Tailwind CSS', action: 'copy', filename: 'palette.tailwind.css', create: (palette: Palette) => textFile(`@theme {\n${palette.map(({ hex, name }, index) => `  --color-${identifier(name, index)}: #${hex};`).join('\n')}\n}\n`, 'text/css') },
  { label: 'JSON', action: 'copy', filename: 'palette.json', create: (palette: Palette) => textFile(`${JSON.stringify(palette.map(({ hex, name }) => ({ hex: `#${hex}`, name })), null, 2)}\n`, 'application/json') },
  { label: 'CSV', action: 'copy', filename: 'palette.csv', create: (palette: Palette) => textFile(`hex,name\r\n${palette.map(({ hex, name }) => `${csv(`#${hex}`)},${csv(name)}`).join('\r\n')}\r\n`, 'text/csv') },
  { label: 'Text', action: 'copy', filename: 'palette.txt', create: (palette: Palette) => textFile(`${palette.map(({ hex, name }) => `#${hex}${name ? `\t${lineName(name)}` : ''}`).join('\n')}\n`) },
  { label: 'Adobe ASE', action: 'download', filename: 'palette.ase', create: ase },
  { label: 'GIMP GPL', action: 'download', filename: 'palette.gpl', create: (palette: Palette) => textFile(`GIMP Palette\nName: Palette\nColumns: 0\n#\n${palette.map(({ hex, name }) => `${rgb(hex).join(' ')}${name ? `\t${lineName(name)}` : ''}`).join('\n')}\n`, 'application/x-gimp-palette') },
  { label: 'PNG', action: 'download', filename: 'palette.png', create: png },
  { label: 'SVG', action: 'download', filename: 'palette.svg', create: svg },
] as const;
