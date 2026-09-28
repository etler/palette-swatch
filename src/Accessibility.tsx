import { contrastRatio, contrastRating, ink, visionModes, type VisionMode } from './color';
import type { Palette } from './palette';

const ratioText = (ratio: number) => `${ratio.toFixed(1)}:1`;

export function Accessibility({ palette, vision, onVision }: {
  readonly palette: Palette;
  readonly vision: VisionMode;
  readonly onVision: (mode: VisionMode) => void;
}) {
  return <>
    <h2>Accessibility</h2>
    <label className="vision-field" htmlFor="vision-mode">Vision Simulation</label>
    <select id="vision-mode" value={vision} onChange={event => onVision(event.target.value as VisionMode)}>
      {visionModes.map(mode => <option key={mode} value={mode}>{mode}</option>)}
    </select>
    <section aria-labelledby="text-contrast-heading">
      <h3 id="text-contrast-heading">Text Contrast</h3>
      <ul className="contrast-list">
        {palette.map(swatch => {
          const foreground = ink(swatch.hex);
          const ratio = contrastRatio(swatch.hex, foreground.slice(1));
          return <li className="text-contrast-row" key={swatch.id} title={`${swatch.name}: ${foreground === '#000000' ? 'black' : 'white'} text · WCAG 2.2 normal text`}>
            <span className="text-sample" aria-hidden="true" style={{ background: `#${swatch.hex}`, color: foreground }}>Aa</span>
            <div className="contrast-details"><span>#{swatch.hex}</span><span className="contrast-name">{swatch.name}</span></div>
            <div className="contrast-result"><span className="contrast-rating">{contrastRating(ratio)}</span><span>{ratioText(ratio)}</span></div>
            <span className="sr-only">{foreground === '#000000' ? 'black' : 'white'} text, WCAG 2.2 normal text</span>
          </li>;
        })}
      </ul>
    </section>
    <section aria-labelledby="adjacent-contrast-heading">
      <h3 id="adjacent-contrast-heading">Adjacent Contrast</h3>
      <ul className="contrast-list">
        {palette.slice(1).map((swatch, index) => {
          const previous = palette[index];
          const ratio = contrastRatio(previous.hex, swatch.hex);
          const rating = ratio >= 3 ? 'Good' : ratio >= 2 ? 'Fair' : 'Low';
          return <li key={`${previous.id}-${swatch.id}`} title={`${previous.name} #${previous.hex} / ${swatch.name} #${swatch.hex}`}>
            <span className="adjacent-sample" aria-hidden="true"><span style={{ background: `#${previous.hex}` }} /><span style={{ background: `#${swatch.hex}` }} /></span>
            <span className="contrast-details">{ratioText(ratio)}</span>
            <span className="contrast-rating" title="Pair contrast: Low < 2:1, Fair < 3:1, Good ≥ 3:1">{rating}</span>
            <span className="sr-only">{previous.name} #{previous.hex} and {swatch.name} #{swatch.hex}</span>
          </li>;
        })}
      </ul>
      {palette.length < 2 && <span aria-label="No adjacent pair">—</span>}
    </section>
  </>;
}
