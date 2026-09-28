import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { atFraction, channels, clamp, coordinates, fraction, modes, parseHex, replace, toHex, type Mode } from './color';

export function Icon({ name }: { readonly name: 'plus' | 'close' | 'shades' | 'copy' | 'dropper' | 'back' | 'check' | 'chevron' | 'menu' | 'settings' | 'keyboard' | 'eye' | 'bookmark' | 'download' | 'export' | 'print' | 'undo' | 'redo' | 'trash' }) {
  const paths = {
    trash: <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />,
    undo: <path d="m9 14-5-5 5-5M4 9h10a6 6 0 0 1 0 12" />,
    redo: <path d="m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12" />,
    print: <><path d="M6 9V3h12v6M6 17H3v-8h18v8h-3M17 12h1" /><rect x="6" y="14" width="12" height="7" rx="1" /></>,
    export: <path d="M12 15V3m-5 5 5-5 5 5M4 16v5h16v-5" />,
    download: <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />,
    bookmark: <path d="M6 3h12v18l-6-4-6 4V3Z" />,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    settings: <><path d="M10 2h4l.6 3 1.5.9 2.9-1 2 3.4-2.3 2v3.4l2.3 2-2 3.4-2.9-1-1.5.9-.6 3h-4l-.6-3-1.5-.9-2.9 1-2-3.4 2.3-2v-3.4L3 8.3l2-3.4 2.9 1 1.5-.9Z" /><circle cx="12" cy="12" r="3" /></>,
    keyboard: <><rect x="2" y="5" width="20" height="14" rx="3" /><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 15h10" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    shades: <><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M4 9.3h16M4 14.7h16" /></>,
    copy: <><rect x="8" y="8" width="12" height="12" rx="3" /><path d="M15 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" /></>,
    dropper: <><path d="m14 4 6 6M16 6l3-3a2 2 0 0 1 3 3l-3 3M15 7 4 18l-1 4 4-1L18 10" /></>,
    back: <path d="m14 5-7 7 7 7" />,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m8 10 4 4 4-4" />,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function Popup({ x, onClose, onCancel, children, label }: { readonly x: number; readonly onClose: () => void; readonly onCancel: () => void; readonly children: ReactNode; readonly label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    ref.current?.showPopover();
    const input = ref.current?.querySelector<HTMLInputElement>('input[data-autofocus]');
    input?.focus();
    input?.select();
  }, []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [onCancel]);
  return <div ref={ref} popover="auto" className="popup" role="dialog" aria-label={label}
    style={{ '--anchor-x': `${x}px` } as CSSProperties}
    onKeyDownCapture={event => {
      if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
        const form = event.currentTarget.querySelector('form');
        if (form) { event.preventDefault(); form.requestSubmit(); }
      }
    }}
    onToggle={event => { if (event.newState === 'closed') onClose(); }}>
    {children}
  </div>;
}

function Gradient({ mode, values, channel }: { readonly mode: Mode; readonly values: readonly number[]; readonly channel: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const context = ref.current?.getContext('2d');
    if (!context) return;
    const c = channels[mode][channel];
    for (const x of Array.from({ length: 256 }, (_, i) => i)) {
      context.fillStyle = `#${toHex(mode, replace(values, channel, atFraction(x / 255, c)))}`;
      context.fillRect(x, 0, 1, 1);
    }
  }, [mode, values, channel]);
  return <canvas ref={ref} width="256" height="1" aria-hidden="true" />;
}

function Plane({ mode, values, original, onChange }: {
  readonly mode: 'HSB' | 'HSL'; readonly values: readonly number[]; readonly original: readonly number[];
  readonly onChange: (values: readonly number[]) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const context = ref.current?.getContext('2d');
    if (!context) return;
    for (const y of Array.from({ length: 80 }, (_, i) => i)) {
      const gradient = context.createLinearGradient(0, 0, 160, 0);
      for (const stop of [0, .25, .5, .75, 1]) {
        gradient.addColorStop(stop, `#${toHex(mode, [values[0], stop * 100, (1 - y / 79) * 100])}`);
      }
      context.fillStyle = gradient;
      context.fillRect(0, y, 160, 1);
    }
  }, [mode, values]);
  const update = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    onChange([values[0], clamp((event.clientX - bounds.left) / bounds.width) * 100, (1 - clamp((event.clientY - bounds.top) / bounds.height)) * 100]);
  };
  return <div className="color-plane" aria-label={`${mode} saturation and ${mode === 'HSB' ? 'brightness' : 'lightness'}`}
    onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); update(event); }}
    onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) update(event); }}>
    <canvas ref={ref} width="160" height="80" aria-hidden="true" />
    <span className="original-dot" style={{ left: `${original[1]}%`, top: `${100 - original[2]}%` }} />
    <span className="plane-handle" style={{ left: `${values[1]}%`, top: `${100 - values[2]}%`, background: `#${toHex(mode, values)}` }} />
  </div>;
}

function pickerControls(form: HTMLFormElement) {
  return Array.from(form.querySelectorAll<HTMLInputElement>('input[name="hex"], input[type="range"]'));
}

export function Picker({ name, initialFocus, onName, mode, values, original, onChange, onMode, onShades, onAccept, onCancel, notify, bookmarked, onBookmark }: {
  readonly name: string; readonly initialFocus: 'hex' | 'name'; readonly onName: (name: string) => void;
  readonly mode: Mode; readonly values: readonly number[]; readonly original: string;
  readonly onCancel: () => void;
  readonly bookmarked: boolean; readonly onBookmark: (hex: string) => void;
  readonly onChange: (values: readonly number[]) => void; readonly onMode: (mode: Mode) => void;
  readonly onShades: (channel: number, values: readonly number[]) => void; readonly onAccept: (values: readonly number[]) => void; readonly notify: (message: string) => void;
}) {
  const [view, setView] = useState<{ readonly screen: 'picker' | 'modes'; readonly focus: 'first' | 'last' | 'default' }>({ screen: 'picker', focus: 'default' });
  const form = useRef<HTMLFormElement>(null);
  const hex = toHex(mode, values);
  const previous = coordinates(original, mode);
  useLayoutEffect(() => {
    if (!form.current) return;
    const controls = pickerControls(form.current);
    const input = view.focus === 'default' && initialFocus === 'name'
      ? form.current.querySelector<HTMLInputElement>('input[name="name"]')
      : controls[view.focus === 'last' ? controls.length - 1 : 0];
    input?.focus();
    input?.select();
  }, [view, initialFocus]);
  useLayoutEffect(() => {
    form.current?.querySelectorAll<HTMLInputElement>('input[type="number"]').forEach(input => {
      input.value = String(Math.round(values[Number(input.dataset.channel)] * 10) / 10);
      if (input === document.activeElement) input.select();
    });
  }, [values, view]);
  const draft = () => {
    const input = document.activeElement;
    if (!(input instanceof HTMLInputElement) || input.form !== form.current) return values;
    if (input.name === 'hex') {
      const parsed = parseHex(input.value);
      return parsed ? coordinates(parsed, mode) : values;
    }
    if (input.type === 'number' && Number.isFinite(input.valueAsNumber)) {
      const index = Number(input.dataset.channel);
      const c = channels[mode][index];
      return replace(values, index, clamp(input.valueAsNumber, c.min, c.max));
    }
    return values;
  };
  const eyeDropper = async () => {
    if (!window.EyeDropper) {
      notify('Screen sampling unsupported in this browser.');
      return;
    }
    try {
      const result = await new window.EyeDropper().open();
      onChange(coordinates(result.sRGBHex.slice(1), mode));
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) notify('Screen sampling is unavailable. Check browser permissions.');
    }
  };
  if (view.screen === 'modes') return <div className="mode-menu" onKeyDown={event => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const options = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('.mode-option'));
    const index = options.findIndex(option => option === document.activeElement);
    const next = index + (['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 1);
    if (event.key === 'ArrowUp' && next < 0) setView({ screen: 'picker', focus: 'last' });
    else if (event.key === 'ArrowDown' && next >= options.length) setView({ screen: 'picker', focus: 'first' });
    else options[(next + options.length) % options.length].focus();
  }}>
    <div className="popup-heading"><span>Color mode</span><button className="icon-button" aria-label="Back to picker" onClick={() => setView({ screen: 'picker', focus: 'default' })}><Icon name="back" /></button></div>
    {modes.map((option, index) => <button key={option} autoFocus={view.focus === 'default' ? option === mode : index === (view.focus === 'first' ? 0 : modes.length - 1)} className="mode-option" onClick={() => { onMode(option); setView({ screen: 'picker', focus: 'default' }); }}><span>{option}</span>{option === mode && <Icon name="check" />}</button>)}
  </div>;
  return <form ref={form} onSubmit={event => { event.preventDefault(); onAccept(draft()); }} onKeyDown={event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.name === 'name') return;
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const controls = pickerControls(event.currentTarget);
      const current = controls.findIndex(control => control === input || control.dataset.channel === input.dataset.channel);
      const next = current + (event.key === 'ArrowDown' ? 1 : -1);
      if (next < 0 || next >= controls.length) {
        onChange(draft());
        setView({ screen: 'modes', focus: next < 0 ? 'last' : 'first' });
        return;
      }
      controls[next].focus();
    } else if (input.dataset.channel !== undefined) {
      const index = Number(input.dataset.channel);
      if (input.type === 'range' && !event.ctrlKey && !event.metaKey && !event.altKey && /^[0-9.-]$/.test(event.key)) {
        const number = input.closest('.channel')?.querySelector<HTMLInputElement>('input[type="number"]');
        number?.focus();
        number?.select();
      }
      if (event.key === ' ') { event.preventDefault(); onShades(index, draft()); }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const c = channels[mode][index];
        const current = draft();
        const step = event.altKey ? .1 : event.shiftKey || event.ctrlKey || event.metaKey ? 10 : 1;
        const value = Math.round((current[index] + (event.key === 'ArrowLeft' ? -step : step)) * 10) / 10;
        input.closest('.channel')?.querySelector<HTMLInputElement>('input[type="range"]')?.focus();
        onChange(replace(current, index, clamp(value, c.min, c.max)));
      }
    }
  }}>
    <div className="picker-main">
      <div className="popup-heading"><input className="picker-name" name="name" aria-label="Color Name" placeholder="Edit color" value={name} maxLength={80}
        data-autofocus={initialFocus === 'name' ? '' : undefined} onFocus={event => event.currentTarget.select()} onChange={event => onName(event.currentTarget.value)} /><div className="picker-heading-actions">
        <button type="button" className="icon-button" aria-label="Cancel color changes" onClick={onCancel}><Icon name="close" /></button>
        <button type="submit" className="icon-button" aria-label="Apply color changes"><Icon name="check" /></button>
      </div></div>
      {(mode === 'HSB' || mode === 'HSL') && <Plane mode={mode} values={values} original={previous} onChange={onChange} />}
      <div className="hex-field"><span className="color-chip" style={{ background: `#${hex}` }} /><label htmlFor="hex-input">HEX</label>
        <input key={hex} id="hex-input" name="hex" data-autofocus={initialFocus === 'hex' ? '' : undefined} defaultValue={hex} required pattern="#?[A-Fa-f0-9]{6}" maxLength={7} aria-label="Hex color" spellCheck={false} onBlur={event => { const parsed = parseHex(event.currentTarget.value); if (parsed) onChange(coordinates(parsed, mode)); }} />
      </div>
      <div className="sliders">{channels[mode].map((c, index) => <div className="channel" key={`${mode}-${c.label}`}>
        <div className="channel-label"><label htmlFor={`channel-${index}`}>{c.label}</label>
          <span><input data-channel={index} aria-label={`${c.label} value`} type="number" min={c.min} max={c.max} step="any" defaultValue={Math.round(values[index] * 10) / 10}
            onBlur={event => {
              if (event.currentTarget.value !== '' && Number.isFinite(event.currentTarget.valueAsNumber)) onChange(replace(values, index, clamp(event.currentTarget.valueAsNumber, c.min, c.max)));
              else event.currentTarget.value = String(Math.round(values[index] * 10) / 10);
            }} />{c.unit}</span></div>
        <div className="channel-controls"><div className="slider-track" style={{ '--thumb': `#${hex}` } as CSSProperties}>
          <Gradient mode={mode} values={values} channel={index} />
          <span className="original-dot" style={{ left: `calc(10px + (100% - 20px) * ${fraction(previous[index], c)})` }} />
          <input data-channel={index} id={`channel-${index}`} type="range" min={c.min} max={c.max} step="0.1" value={values[index]} onChange={event => onChange(replace(values, index, event.currentTarget.valueAsNumber))} />
        </div><button type="button" className="icon-button shades-button" aria-label={`Explore ${c.label.toLowerCase()} shades`} onClick={() => onShades(index, draft())}><Icon name="shades" /></button></div>
      </div>)}</div>
    </div>
    <div className="picker-footer"><button type="button" className="mode-trigger" onClick={() => setView({ screen: 'modes', focus: 'default' })} aria-label="Change color mode">{mode}<Icon name="chevron" /></button>
      <div className="footer-actions"><button type="button" className="icon-button" aria-label="Pick a color from your screen" onClick={eyeDropper}><Icon name="dropper" /></button>
        <button type="button" className="icon-button" aria-label="Copy hex code" onClick={async () => { try { await navigator.clipboard.writeText(hex); notify(`Copied ${hex}`); } catch { notify('Copy unavailable. Select the HEX field and copy it.'); } }}><Icon name="copy" /></button>
        <button type="button" className="icon-button bookmark-toggle" aria-label="Bookmark swatch" aria-pressed={bookmarked} title={bookmarked ? 'Remove bookmark' : 'Save bookmark'} onClick={() => onBookmark(hex)}><Icon name="bookmark" /></button></div>
    </div>
  </form>;
}
