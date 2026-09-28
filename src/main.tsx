import { Fragment, StrictMode, useEffect, useEffectEvent, useReducer, useRef, useState, type CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import { clamp, coordinates, ink, parseHex, shades, toHex, type Mode } from './color';
import { historyReducer, insertionColor, move, parse, persist, type Palette, type Swatch } from './palette';
import { Icon, Picker, Popup } from './Picker';
import './style.css';

type Editor = Readonly<{ kind: 'closed' }>
  | Readonly<{ kind: 'name'; swatch: Swatch; x: number }>
  | Readonly<{ kind: 'color'; swatch: Swatch; x: number; values: readonly number[] }>
  | Readonly<{ kind: 'shades'; swatch: Swatch; values: readonly number[]; channel: number }>;
type Drag = Readonly<{ id: string; startX: number; x: number; width: number; origin: number }>;
const paint = (hex: string): CSSProperties => ({ '--color': `#${hex}`, '--ink': ink(hex) } as CSSProperties);
function focusSwatch(id: string, part = 'swatch') {
  const swatch = document.getElementById(`swatch-${id}`);
  (part === 'swatch' ? swatch : swatch?.querySelector<HTMLElement>(`[data-target="${part}"]`))?.focus({ preventScroll: true });
}

function App() {
  const [history, dispatch] = useReducer(historyReducer, location.hash, hash => ({ past: [], present: parse(hash), future: [] }));
  const [mode, setMode] = useState<Mode>('HSB');
  const [editor, setEditor] = useState<Editor>({ kind: 'closed' });
  const [drag, setDrag] = useState<Drag | null>(null);
  const [notice, setNotice] = useState('');
  const [keyboard, setKeyboard] = useState(false);
  const [outline, setOutline] = useState<{ readonly mode: 'none' | 'outer' | 'swatches'; readonly color: 'white' | 'black' }>({ mode: 'none', color: 'white' });
  const swatchSpace = useRef<Readonly<{ id: string; time: number }> | undefined>(undefined);
  const activateOutline = (primary: 'mode' | 'color' = 'mode') => setOutline(current => primary === 'color'
    ? { mode: current.mode === 'none' ? 'outer' : current.mode, color: current.color === 'white' ? 'black' : 'white' }
    : { ...current, mode: current.mode === 'none' ? 'outer' : current.mode === 'outer' ? 'swatches' : 'none' });
  const palette = history.present;
  const target = drag ? Math.round(clamp((drag.x - drag.startX) / drag.width + drag.origin, 0, palette.length - 1)) : 0;
  const arranged = drag ? move(palette, drag.id, target) : palette;
  const update = (swatch: Swatch) => palette.map(item => item.id === swatch.id ? swatch : item);
  const commit = (next: Palette) => {
    if (next.length === palette.length) next.forEach((swatch, position) => {
      const previous = palette.findIndex(item => item.id === swatch.id);
      const element = document.getElementById(`swatch-${swatch.id}`);
      if (!element || previous < 0 || previous === position) return;
      const style = getComputedStyle(element);
      const gap = parseFloat(style.getPropertyValue('--swatch-gap'));
      const distance = (previous - position) * (element.getBoundingClientRect().width + gap);
      const offset = new DOMMatrixReadOnly(style.transform).m41 + distance;
      // Preserve the visible position while the DOM moves into its new flex slot.
      element.animate([{ transform: `translateX(${offset}px)` }, { transform: 'translateX(0px)' }], {
        duration: Number(style.getPropertyValue('--swap-duration')),
        easing: style.getPropertyValue('--swap-easing'),
      });
    });
    dispatch({ type: 'commit', palette: next });
  };
  const remove = (id: string) => {
    if (palette.length > 1) {
      const index = palette.findIndex(swatch => swatch.id === id);
      const next = palette.filter(swatch => swatch.id !== id);
      commit(next);
      requestAnimationFrame(() => focusSwatch(next[Math.min(index, next.length - 1)].id));
    }
  };
  const dismiss = () => {
    if (editor.kind !== 'closed') {
      const id = editor.swatch.id;
      const part = editor.kind === 'name' ? 'name' : 'hex';
      requestAnimationFrame(() => focusSwatch(id, part));
    }
    setEditor({ kind: 'closed' });
  };
  const close = () => {
    if (editor.kind === 'color') commit(update({ ...editor.swatch, hex: toHex(mode, editor.values) }));
    setEditor({ kind: 'closed' });
  };
  useEffect(() => { persist(palette); }, [palette]);
  useEffect(() => {
    const load = () => { setEditor({ kind: 'closed' }); setDrag(null); dispatch({ type: 'commit', palette: parse(location.hash) }); };
    window.addEventListener('hashchange', load);
    return () => window.removeEventListener('hashchange', load);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(''), 4200);
    return () => clearTimeout(timeout);
  }, [notice]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== ' ' || event.ctrlKey || event.metaKey || event.altKey) swatchSpace.current = undefined;
      if ((event.ctrlKey || event.metaKey) && event.key === ' ' && !event.altKey) {
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) activateOutline(event.shiftKey ? 'color' : 'mode');
        return;
      }
      if (event.altKey && event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        const request = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
        request.catch(() => setNotice('Fullscreen unavailable.'));
        return;
      }
      if (event.key === 'Escape' && document.fullscreenElement) void document.exitFullscreen();
      if (editor.kind !== 'closed' && (event.key.startsWith('Arrow') || ['Tab', 'Enter', ' '].includes(event.key))) setKeyboard(true);
      if (editor.kind === 'shades') {
        if (event.key === 'Escape') { event.preventDefault(); dismiss(); }
        return;
      }
      if (editor.kind !== 'closed') return;
      if (event.target instanceof HTMLInputElement && !['range', 'number'].includes(event.target.type)) return;
      if (event.key === 'Escape') { setDrag(null); setKeyboard(false); return; }
      if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
        event.preventDefault();
        const type = event.key.toLowerCase() === 'y' || event.shiftKey ? 'redo' : 'undo';
        setDrag(null);
        dispatch({ type });
        return;
      }
      const active = document.activeElement;
      const swatch = active?.closest<HTMLElement>('.swatch');
      const index = palette.findIndex(item => `swatch-${item.id}` === swatch?.id);
      if (event.key === 'Tab') {
        if (!keyboard && !event.shiftKey && index >= 0) {
          event.preventDefault();
          focusSwatch(palette[index].id);
        }
        setKeyboard(true);
        return;
      }
      if (event.key === ' ' && !event.ctrlKey && !event.metaKey && !event.altKey && (active === swatch || active === document.body)) {
        event.preventDefault();
        if (event.repeat) return;
        const selected = palette[Math.max(0, index)];
        const previous = swatchSpace.current;
        setKeyboard(true);
        focusSwatch(selected.id);
        if (previous?.id === selected.id && event.timeStamp - previous.time <= 350) {
          swatchSpace.current = undefined;
          add(Math.max(0, index) + 1);
        } else swatchSpace.current = { id: selected.id, time: event.timeStamp };
        return;
      }
      if (!keyboard && !event.ctrlKey && !event.metaKey && !event.altKey && ['Enter', ' '].includes(event.key)) {
        event.preventDefault();
        setKeyboard(true);
        focusSwatch(palette[Math.max(0, index)].id, active instanceof HTMLElement ? active.dataset.target : undefined);
        return;
      }
      if (keyboard && index >= 0 && event.ctrlKey && ['c', 'v'].includes(event.key.toLowerCase())) {
        event.preventDefault();
        if (event.key.toLowerCase() === 'c') {
          navigator.clipboard.writeText(palette[index].hex).catch(() => setNotice('Clipboard access unavailable.'));
        } else {
          const id = palette[index].id;
          navigator.clipboard.readText().then(text => pasteColor(id, text)).catch(() => setNotice('Clipboard access unavailable.'));
        }
        return;
      }
      if (event.key.startsWith('Arrow')) {
        event.preventDefault();
        if (event.ctrlKey || event.metaKey || event.altKey) {
          if (index >= 0 && ['ArrowLeft', 'ArrowRight'].includes(event.key)) commit(move(palette, palette[index].id, index + (event.key === 'ArrowLeft' ? -1 : 1)));
          return;
        }
        setKeyboard(true);
        const part = active instanceof HTMLElement ? active.dataset.target ?? 'swatch' : 'swatch';
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          const next = keyboard && index >= 0 ? (index + (event.key === 'ArrowLeft' ? -1 : 1) + palette.length) % palette.length : Math.max(0, index);
          focusSwatch(palette[next].id, part);
        } else {
          const parts = ['swatch', 'hex', 'name'];
          const next = keyboard && index >= 0
            ? (parts.indexOf(part) + (event.key === 'ArrowDown' ? 1 : 2)) % parts.length
            : event.key === 'ArrowDown' ? 1 : 0;
          focusSwatch(palette[Math.max(0, index)].id, parts[next]);
        }
      } else if (index >= 0 && ['Delete', 'Backspace'].includes(event.key)) {
        event.preventDefault(); remove(palette[index].id);
      } else if (keyboard && active === swatch && event.key === 'Enter') {
        event.preventDefault(); swatch?.querySelector<HTMLButtonElement>('.hex-button')?.click();
      }
    };
    const onPointer = () => { swatchSpace.current = undefined; setKeyboard(false); };
    const onPaste = (event: ClipboardEvent) => {
      const element = document.activeElement?.closest<HTMLElement>('.swatch');
      const swatch = palette.find(item => `swatch-${item.id}` === element?.id);
      if (swatch && pasteColor(swatch.id, event.clipboardData?.getData('text/plain') ?? '')) event.preventDefault();
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('paste', onPaste);
    };
  });
  const add = (position: number, hex = insertionColor(palette, position)) => {
    const nextName = Math.max(0, ...palette.map(swatch => Number(/^Color (\d+)$/.exec(swatch.name)?.[1] ?? 0))) + 1;
    const swatch = { id: crypto.randomUUID(), name: `Color ${nextName}`, hex };
    commit([...palette.slice(0, position), swatch, ...palette.slice(position)]);
    if (keyboard) requestAnimationFrame(() => focusSwatch(swatch.id));
  };
  const pasteColor = useEffectEvent((id: string, text: string) => {
    const index = palette.findIndex(swatch => swatch.id === id);
    if (!keyboard || editor.kind !== 'closed' || index < 0) return false;
    const hex = parseHex(text);
    if (hex) add(index + 1, hex);
    else setNotice('Clipboard must contain a hex color.');
    return true;
  });
  const addControl = (index: number) => !drag && editor.kind === 'closed' && <div className="add-zone" style={{ '--boundary': index } as CSSProperties}>
    <button className="add-color" aria-label={`Add color at position ${index + 1}`} onClick={() => add(index)}><Icon name="plus" /></button>
  </div>;
  return <>
    <h1 className="sr-only">Palette explorer</h1>
    <main className={`palette ${drag ? 'is-dragging' : ''} ${keyboard && editor.kind === 'closed' ? 'keyboard-navigation' : ''}`} data-outline={outline.mode} aria-label="Color palette" aria-keyshortcuts="Control+z Meta+z Control+Shift+z Meta+Shift+z Control+y Control+c Control+v Control+Space Meta+Space Control+Shift+Space Meta+Shift+Space Alt+Enter" style={{ '--count': palette.length, '--outline-color': outline.color } as CSSProperties}
      onCopy={event => {
        const swatch = document.activeElement?.closest<HTMLElement>('.swatch');
        const color = palette.find(item => `swatch-${item.id}` === swatch?.id);
        if (!keyboard || editor.kind !== 'closed' || !color) return;
        event.preventDefault(); event.clipboardData.setData('text/plain', color.hex);
      }}
      onPointerDown={event => {
        if (event.button !== 0 || (event.target instanceof Element && event.target.closest('button, input')) || editor.kind !== 'closed') return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const left = bounds.left + event.currentTarget.clientLeft;
        const top = bounds.top + event.currentTarget.clientTop;
        if (event.clientX < left || event.clientX >= left + event.currentTarget.clientWidth || event.clientY < top || event.clientY >= top + event.currentTarget.clientHeight) return;
        const gap = parseFloat(getComputedStyle(event.currentTarget).columnGap);
        const width = (event.currentTarget.clientWidth + gap) / palette.length;
        const origin = clamp(Math.floor((event.clientX - left + gap / 2) / width), 0, palette.length - 1);
        event.preventDefault();
        focusSwatch(palette[origin].id);
        event.currentTarget.setPointerCapture(event.pointerId);
        setDrag({ id: palette[origin].id, startX: event.clientX, x: event.clientX, width, origin });
      }}
      onPointerMove={event => { if (drag) setDrag({ ...drag, x: event.clientX }); }}
      onPointerUp={() => { if (drag) { commit(arranged); setDrag(null); } }}
      onPointerCancel={() => setDrag(null)}
      onDoubleClick={event => {
        if (editor.kind !== 'closed' || (event.target instanceof Element && event.target.closest('button, input'))) return;
        // Pointer capture routes clicks here; pointer-down already selected the swatch.
        const swatch = document.activeElement?.closest<HTMLElement>('.swatch');
        if (!swatch) return;
        const bounds = swatch.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX >= bounds.right || event.clientY < bounds.top || event.clientY >= bounds.bottom) return;
        const index = palette.findIndex(item => `swatch-${item.id}` === swatch.id);
        if (index >= 0) add(index + 1);
      }}>
      {palette.map((swatch, index) => {
        const hex = editor.kind === 'color' && editor.swatch.id === swatch.id ? toHex(mode, editor.values) : swatch.hex;
        const position = arranged.findIndex(item => item.id === swatch.id);
        const isDragged = drag?.id === swatch.id;
        const exploring = editor.kind === 'shades' && editor.swatch.id === swatch.id;
        return <Fragment key={swatch.id}>
          {index === 0 && addControl(0)}
          <section id={`swatch-${swatch.id}`} data-target="swatch" className={`swatch ${isDragged ? 'dragged' : ''}`} aria-label={swatch.name} aria-keyshortcuts="Control+ArrowLeft Control+ArrowRight Alt+ArrowLeft Alt+ArrowRight Delete Backspace" tabIndex={0}
            style={{ ...paint(hex), '--offset': position - index, ...(isDragged ? { transform: `translateX(${drag.x - drag.startX}px)` } : {}) } as CSSProperties}>
            {exploring ? <div className="shade-list" role="group" aria-label="Choose a shade" onKeyDown={event => {
              if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const options = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('.shade'));
              const current = options.findIndex(option => option === document.activeElement);
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? 24 : clamp(current + (['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 1), 0, 24);
              options[next].focus();
            }}>
              {shades(mode, editor.values, editor.channel).map((shade, i) => <button key={i} className="shade" style={paint(shade.hex)} aria-label={shade.code} aria-current={shade.original ? 'true' : undefined}
                autoFocus={shade.original} onClick={() => { commit(update({ ...swatch, hex: shade.hex })); dismiss(); }}>
                {shade.original && <span className="original-dot" />}<span className="shade-code">{shade.code}</span>
              </button>)}
              <button className="shade-back icon-button" aria-label="Cancel shades" onClick={dismiss}><Icon name="close" /></button>
            </div> : <div className="swatch-label">
              <button data-target="hex" className="hex-button" aria-label={`Edit ${swatch.name} color ${hex}`} onClick={event => {
                const bounds = event.currentTarget.getBoundingClientRect();
                close();
                setEditor({ kind: 'color', swatch: { ...swatch, hex }, values: coordinates(hex, mode), x: bounds.left + bounds.width / 2 });
              }}>{hex}</button>
              <button data-target="name" className="name-button" aria-label={`Rename ${swatch.name}`} onClick={event => {
                const bounds = event.currentTarget.getBoundingClientRect();
                close();
                setEditor({ kind: 'name', swatch: { ...swatch, hex }, x: bounds.left + bounds.width / 2 });
              }}>{swatch.name}</button>
            </div>}
            {!drag && editor.kind === 'closed' && palette.length > 1 && ['top', 'bottom'].map(edge => <div key={edge} className={`delete-zone delete-zone-${edge}`}>
              <button className="delete-color" tabIndex={edge === 'bottom' ? -1 : undefined} aria-label={`Delete ${swatch.name}`} onClick={() => remove(swatch.id)}><Icon name="close" /></button>
            </div>)}
          </section>
          {addControl(index + 1)}
        </Fragment>;
      })}
      {!drag && editor.kind === 'closed' && ['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(corner => {
        const action = corner.endsWith('right') ? 'color' : 'mode';
        return <div key={corner} className={`outline-zone outline-zone-${corner}`}>
          <button className="outline-button" tabIndex={corner.startsWith('top') ? 0 : -1} aria-label={`${action === 'color' ? 'Change outline color' : 'Cycle outline mode'} (${outline.mode === 'none' ? 'edge to edge' : outline.mode === 'outer' ? 'outside border' : 'swatch borders'}, ${outline.color})`} aria-keyshortcuts={action === 'mode' ? 'Control+Space Meta+Space' : 'Control+Shift+Space Meta+Shift+Space'}
            onPointerDown={event => event.preventDefault()} onClick={() => activateOutline(action)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              {action === 'color' ? <path className="outline-ink" d="M12 3C10 6 5 10 5 14a7 7 0 0 0 14 0c0-4-5-8-7-11Z" />
                : <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 4v16M15 4v16" /></>}
            </svg>
          </button>
        </div>;
      })}
    </main>
    {(editor.kind === 'color' || editor.kind === 'name') && <Popup key={`${editor.kind}-${editor.swatch.id}`} x={editor.x} label={editor.kind === 'color' ? 'Color picker' : 'Rename color'} onClose={close} onCancel={dismiss}>
      {editor.kind === 'name' ? <form className="rename-form" onSubmit={event => {
        event.preventDefault();
        const name = String(new FormData(event.currentTarget).get('name')).trim();
        if (name) { commit(update({ ...editor.swatch, name })); dismiss(); }
      }}><div className="popup-heading"><label htmlFor="name-input">Color Name</label><button type="button" className="icon-button" aria-label="Cancel rename" onClick={dismiss}><Icon name="close" /></button></div>
        <input id="name-input" name="name" defaultValue={editor.swatch.name} maxLength={80} required />
        <button className="save-button" type="submit">Save name<Icon name="check" /></button>
      </form> : <Picker mode={mode} values={editor.values} original={editor.swatch.hex} onAccept={values => { commit(update({ ...editor.swatch, hex: toHex(mode, values) })); dismiss(); }} notify={setNotice}
        onChange={values => setEditor({ ...editor, values })}
        onMode={next => { setEditor({ ...editor, values: coordinates(toHex(mode, editor.values), next) }); setMode(next); }}
        onShades={(channel, values) => {
          setEditor({ kind: 'shades', swatch: editor.swatch, values, channel });
        }} />}
    </Popup>}
    <div className={`toast ${notice ? 'visible' : ''}`} role="status">{notice}</div>
  </>;
}

const root = document.getElementById('root');
if (!root) throw new Error('The palette root element is missing.');
createRoot(root).render(<StrictMode><App /></StrictMode>);
