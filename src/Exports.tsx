import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Picker';
import { ink } from './color';
import { exportFormats } from './palette-exports';
import type { Palette } from './palette';

export function Exports({ palette }: { readonly palette: Palette }) {
  const [error, setError] = useState('');
  return <>
    <h2>Export</h2>
    <div className="export-buttons">
      <button type="button" onClick={() => window.print()}>Print / PDF<Icon name="print" /></button>
      {exportFormats.map(format => <button key={format.filename} type="button" title={`${format.action === 'copy' ? 'Copy' : 'Download'} ${format.label}`} onClick={async () => {
        setError('');
        try {
          if (format.action === 'copy') {
            await navigator.clipboard.write([new ClipboardItem({
              'text/plain': new Blob([format.create(palette)], { type: 'text/plain' }),
            })]);
            return;
          }
          const blob = await format.create(palette);
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = format.filename;
          link.click();
          // Keep the URL alive until the browser has consumed the download.
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch {
          setError(`${format.label} export failed. Please try again.`);
        }
      }}><span>{format.label}</span><Icon name={format.action} /></button>)}
    </div>
    {error && <p role="alert" className="export-error">{error}</p>}
    {createPortal(<div className="palette-print">
      <h1>Color palette</h1>
      <div className="print-swatches">{palette.map(({ id, hex, name }) => <div key={id} className="print-swatch" style={{ background: `#${hex}`, color: ink(hex) }}>
        <strong>{hex}</strong>{name && <span>{name}</span>}
      </div>)}</div>
    </div>, document.body)}
  </>;
}
