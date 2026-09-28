import { Fragment, StrictMode, useEffect, useEffectEvent, useLayoutEffect, useReducer, useRef, useState, type CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import { clamp, colorInfo, coordinates, ink, parseHex, shades, simulateVision, toHex, type Mode, type VisionMode } from './color';
import { historyReducer, insertionColor, move, parse, persist, type Palette, type Swatch } from './palette';
import { Icon, Picker, Popup } from './Picker';
import { readSettings, SettingsPanel } from './Settings';
import { useBookmarks } from './Bookmarks';
import './style.css';

type Editor = Readonly<{ kind: 'closed' }>
  | Readonly<{ kind: 'name'; swatch: Swatch; x: number }>
  | Readonly<{ kind: 'color'; swatch: Swatch; x: number; values: readonly number[] }>
  | Readonly<{ kind: 'shades'; swatch: Swatch; values: readonly number[]; channel: number }>;
type Drag = Readonly<{ id: string; startX: number; startY: number; x: number; y: number; width: number; height: number; origin: number }>;
const paint = (hex: string): CSSProperties => ({ '--color': `#${hex}`, '--ink': ink(hex) } as CSSProperties);
function focusSwatch(id: string, part = 'swatch') {
  const swatch = document.getElementById(`swatch-${id}`);
  (part === 'swatch' ? swatch : swatch?.querySelector<HTMLElement>(`[data-target="${part}"]`))?.focus();
}

function measureTitles(element: HTMLDivElement | null) {
  if (!element) return;
  const measure = () => element.parentElement?.style.setProperty('--title-height', `${element.getBoundingClientRect().height}px`);
  measure();
  const observer = new ResizeObserver(measure);
  observer.observe(element);
  return () => observer.disconnect();
}

function App() {
  const [history, dispatch] = useReducer(historyReducer, location.hash, hash => ({ past: [], present: parse(hash), future: [] }));
  const [mode, setMode] = useState<Mode>('HSB');
  const [vision, setVision] = useState<VisionMode>('Normal');
  const [editor, setEditor] = useState<Editor>({ kind: 'closed' });
  const [drag, setDrag] = useState<Drag | null>(null);
  const [notice, setNotice] = useState('');
  const [bookmarks, setBookmarks] = useBookmarks(setNotice);
  const [keyboard, setKeyboard] = useState(false);
  const [showInfo, setShowInfo] = useState(() => {
    try {
      return localStorage.getItem('palette:info') === 'true';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('palette:info', String(showInfo));
    } catch {
      // The info toggle still works when browser storage is blocked.
    }
  }, [showInfo]);
  const [settingsOpen, setSettingsOpen] = useState(() => {
    try {
      return localStorage.getItem('palette:sidebar-open') === 'true';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('palette:sidebar-open', String(settingsOpen));
    } catch {
      // The sidebar still works when browser storage is blocked.
    }
  }, [settingsOpen]);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const [settings, setSettings] = useState(readSettings);
  useEffect(() => {
    try {
      localStorage.setItem('palette:settings', JSON.stringify(settings));
    } catch {
      // Settings still work when browser storage is blocked.
    }
  }, [settings]);
  const paletteElement = useRef<HTMLElement>(null);
  const [capacity, setCapacity] = useState(1);
  useLayoutEffect(() => {
    const element = paletteElement.current;
    if (!element) return;
    const measure = () => {
      const gap = parseFloat(getComputedStyle(element).columnGap);
      setCapacity(Math.max(1, Math.floor((element.clientWidth + gap) / (settings.minimumSwatchWidth + gap))));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [settings.minimumSwatchWidth]);
  const [outline, setOutline] = useState<{ readonly mode: 'none' | 'outer' | 'swatches'; readonly color: 'white' | 'black' }>(() => {
    try {
      const [mode, color] = (localStorage.getItem('palette:outline') ?? '').split(':');
      return { mode: mode === 'outer' || mode === 'swatches' ? mode : 'none', color: color === 'black' ? 'black' : 'white' };
    } catch {
      return { mode: 'none', color: 'white' };
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('palette:outline', `${outline.mode}:${outline.color}`);
    } catch {
      // Outline controls still work when browser storage is blocked.
    }
  }, [outline]);
  const swatchSpace = useRef<Readonly<{ id: string; time: number }> | undefined>(undefined);
  const activateOutline = (primary: 'mode' | 'color' = 'mode') => setOutline(current => primary === 'color'
    ? { mode: current.mode === 'none' ? 'outer' : current.mode, color: current.color === 'white' ? 'black' : 'white' }
    : { ...current, mode: current.mode === 'none' ? 'outer' : current.mode === 'outer' ? 'swatches' : 'none' });
  const palette = history.present;
  const rows = Math.ceil(palette.length / capacity);
  const columns = Math.ceil(palette.length / rows);
  const target = drag ? Math.min(palette.length - 1,
    clamp(Math.round((drag.y - drag.startY) / drag.height) + Math.floor(drag.origin / columns), 0, rows - 1) * columns +
    clamp(Math.round((drag.x - drag.startX) / drag.width) + drag.origin % columns, 0, columns - 1)) : 0;
  const arranged = drag ? move(palette, drag.id, target) : palette;
  const previewPalette = palette.map(swatch => editor.kind === 'color' && editor.swatch.id === swatch.id ? { ...swatch, hex: toHex(mode, editor.values) } : swatch);
  const update = (swatch: Swatch) => palette.map(item => item.id === swatch.id ? swatch : item);
  const commit = (next: Palette) => {
    if (next.length === palette.length) next.forEach((swatch, position) => {
      const previous = palette.findIndex(item => item.id === swatch.id);
      const element = document.getElementById(`swatch-${swatch.id}`);
      if (!element || previous < 0 || previous === position) return;
      const style = getComputedStyle(element);
      const gap = parseFloat(style.getPropertyValue('--swatch-gap'));
      const bounds = element.getBoundingClientRect();
      const matrix = new DOMMatrixReadOnly(style.transform);
      const x = matrix.m41 + (previous % columns - position % columns) * (bounds.width + gap);
      const y = matrix.m42 + (Math.floor(previous / columns) - Math.floor(position / columns)) * (bounds.height + gap);
      // Preserve the visible position while the DOM moves into its new grid cell.
      element.animate([{ transform: `translate(${x}px, ${y}px)` }, { transform: 'translate(0px, 0px)' }], {
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
      if (event.shiftKey && event.code === 'Slash' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.isComposing
        && !(event.target instanceof HTMLInputElement && !['number', 'range'].includes(event.target.type))) {
        event.preventDefault();
        if (!event.repeat) {
          setKeyboard(true);
          setSettingsOpen(open => !open);
          if (settingsOpen) settingsButton.current?.focus();
        }
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
      if (event.target instanceof Element && event.target.closest('.settings-panel')) {
        if (event.key === 'Tab') setKeyboard(true);
        return;
      }
      if (editor.kind !== 'closed' && (event.key.startsWith('Arrow') || ['Tab', 'Enter', ' '].includes(event.key))) setKeyboard(true);
      if (editor.kind === 'shades') {
        if (event.key === 'Escape') { event.preventDefault(); dismiss(); }
        return;
      }
      if (editor.kind !== 'closed') return;
      if (event.target instanceof Element && event.target.closest('.swatch-info')) return;
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
      if (!keyboard && !event.ctrlKey && !event.metaKey && !event.altKey && ['Enter', ' '].includes(event.key) && (index >= 0 || active === document.body)) {
        event.preventDefault();
        setKeyboard(true);
        focusSwatch(palette[Math.max(0, index)].id, active instanceof HTMLElement ? active.dataset.target : undefined);
        return;
      }
      if (index >= 0 && event.ctrlKey && (event.key.toLowerCase() === 'c' || keyboard && event.key.toLowerCase() === 'v')) {
        event.preventDefault();
        if (event.key.toLowerCase() === 'c') {
          setKeyboard(true);
          focusSwatch(palette[index].id);
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
          if (index >= 0 && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
            setKeyboard(true);
            focusSwatch(palette[index].id);
            commit(move(palette, palette[index].id, index + (event.key === 'ArrowLeft' ? -1 : 1)));
          }
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
        event.preventDefault();
        setKeyboard(true);
        focusSwatch(palette[index].id);
        remove(palette[index].id);
      } else if (keyboard && active === swatch && event.key === 'Enter') {
        event.preventDefault(); swatch?.querySelector<HTMLButtonElement>('.hex-button')?.click();
      }
    };
    const onPointer = () => { swatchSpace.current = undefined; setKeyboard(false); };
    const onPaste = (event: ClipboardEvent) => {
      if (event.target instanceof Element && event.target.closest('.swatch-info')) return;
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
    const swatch = { id: crypto.randomUUID(), name: '', hex };
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
  const addControl = (index: number) => {
    const anchor = Math.max(0, index - 1);
    return !drag && editor.kind === 'closed' && <div className="add-zone" data-edge={index === 0 ? 'start' : index % columns === 0 || index === palette.length ? 'end' : undefined}
      style={{ gridColumn: `${anchor % columns + 1} / span 1`, gridRow: `${Math.floor(anchor / columns) + 1} / span 1` }}>
      <button className="add-color" aria-label={`Add color at position ${index + 1}`} onClick={() => add(index)}><Icon name="plus" /></button>
    </div>;
  };
  return <>
    <h1 className="sr-only">Palette explorer</h1>
    <div className="app-layout">
    <div className="palette-workspace">
    <main ref={paletteElement} className={`palette ${showInfo ? 'has-info' : ''} ${drag ? 'is-dragging' : ''} ${keyboard && editor.kind === 'closed' ? 'keyboard-navigation' : ''}`} data-outline={outline.mode} aria-label="Color palette" aria-keyshortcuts="Control+z Meta+z Control+Shift+z Meta+Shift+z Control+y Control+c Control+v Control+Space Meta+Space Control+Shift+Space Meta+Shift+Space Alt+Enter" style={{ '--columns': columns, '--rows': rows, '--outline-color': outline.color, '--outer-border': settings.windowOutlineWidth === undefined ? undefined : `${settings.windowOutlineWidth}px`, '--swatch-border': settings.borderOutlineWidth === undefined ? undefined : `${settings.borderOutlineWidth}px` } as CSSProperties}
      onCopy={event => {
        const swatch = document.activeElement?.closest<HTMLElement>('.swatch');
        const color = palette.find(item => `swatch-${item.id}` === swatch?.id);
        if (editor.kind !== 'closed' || !color) return;
        event.preventDefault(); event.clipboardData.setData('text/plain', color.hex);
        setKeyboard(true);
        focusSwatch(color.id);
      }}
      onPointerDown={event => {
        if (event.button !== 0 || (event.target instanceof Element && event.target.closest('button, input')) || editor.kind !== 'closed') return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const left = bounds.left + event.currentTarget.clientLeft;
        const top = bounds.top + event.currentTarget.clientTop;
        if (event.clientX < left || event.clientX >= left + event.currentTarget.clientWidth || event.clientY < top || event.clientY >= top + event.currentTarget.clientHeight) return;
        const style = getComputedStyle(event.currentTarget);
        const gap = parseFloat(style.columnGap);
        const width = (event.currentTarget.clientWidth + gap) / columns;
        const height = parseFloat(style.gridTemplateRows) + gap;
        const column = clamp(Math.floor((event.clientX - left + gap / 2) / width), 0, columns - 1);
        const row = Math.floor((event.clientY - top + event.currentTarget.scrollTop + gap / 2) / height);
        const origin = row * columns + column;
        if (origin >= palette.length) return;
        event.preventDefault();
        // Keep the pointer geometry steady while starting a drag.
        event.currentTarget.querySelectorAll<HTMLElement>('.swatch')[origin].focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        setDrag({ id: palette[origin].id, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, width, height, origin });
      }}
      onPointerMove={event => {
        if (!drag) return;
        const element = event.currentTarget;
        const bounds = element.getBoundingClientRect();
        const gap = parseFloat(getComputedStyle(element).columnGap);
        const left = bounds.left + element.clientLeft;
        const top = bounds.top + element.clientTop;
        const visibleLeft = Math.max(0, left);
        const visibleTop = Math.max(0, top);
        const visibleWidth = Math.min(window.innerWidth, left + element.clientWidth) - visibleLeft;
        const visibleHeight = Math.min(window.innerHeight, top + element.clientHeight) - visibleTop;
        const minX = drag.startX - (drag.origin % columns) * drag.width + visibleLeft - left;
        const minY = drag.startY - Math.floor(drag.origin / columns) * drag.height + element.scrollTop + visibleTop - top;
        setDrag({ ...drag,
          x: clamp(event.clientX, minX, minX + Math.max(0, visibleWidth - (drag.width - gap))),
          y: clamp(event.clientY, minY, minY + Math.max(0, visibleHeight - (drag.height - gap))),
        });
      }}
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
      {previewPalette.map((swatch, index) => {
        const hex = swatch.hex;
        const label = swatch.name || `Color ${index + 1}`;
        const position = arranged.findIndex(item => item.id === swatch.id);
        const isDragged = drag?.id === swatch.id;
        const exploring = editor.kind === 'shades' && editor.swatch.id === swatch.id;
        return <Fragment key={swatch.id}>
          {index === 0 && addControl(0)}
          <section id={`swatch-${swatch.id}`} data-target="swatch" className={`swatch ${isDragged ? 'dragged' : ''}`} aria-label={label} aria-keyshortcuts="Control+ArrowLeft Control+ArrowRight Alt+ArrowLeft Alt+ArrowRight Delete Backspace" tabIndex={0}
            style={{ ...paint(simulateVision(hex, vision)), '--offset-x': position % columns - index % columns, '--offset-y': Math.floor(position / columns) - Math.floor(index / columns), ...(isDragged ? { transform: `translate(${drag.x - drag.startX}px, ${drag.y - drag.startY}px)` } : {}) } as CSSProperties}>
            {exploring ? <div className="shade-list" role="group" aria-label="Choose a shade" onKeyDown={event => {
              if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const options = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('.shade'));
              const current = options.findIndex(option => option === document.activeElement);
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? 24 : clamp(current + (['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 1), 0, 24);
              options[next].focus();
            }}>
              {shades(mode, editor.values, editor.channel).map((shade, i) => <button key={i} className="shade" style={paint(simulateVision(shade.hex, vision))} aria-label={shade.code} aria-current={shade.original ? 'true' : undefined}
                autoFocus={shade.original} onClick={() => { commit(update({ ...swatch, hex: shade.hex })); dismiss(); }}>
                {shade.original && <span className="original-dot" />}<span className="shade-code">{shade.code}</span>
              </button>)}
              <button className="shade-back icon-button" aria-label="Cancel shades" onClick={dismiss}><Icon name="close" /></button>
            </div> : <div className="swatch-label">
              {showInfo && <div className="swatch-info" role="region" aria-label={`${label} color information`} tabIndex={0}
                onPointerDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()} onCopy={event => event.stopPropagation()}>
                <dl>{colorInfo(hex).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
              </div>}
              <div className="swatch-titles" ref={measureTitles}>
                <button data-target="hex" className="hex-button" aria-label={`Edit ${label} color ${hex}`} onClick={event => {
                  const bounds = event.currentTarget.getBoundingClientRect();
                  close();
                  setEditor({ kind: 'color', swatch: { ...swatch, hex }, values: coordinates(hex, mode), x: bounds.left + bounds.width / 2 });
                }}>{hex}</button>
                <button data-target="name" className="name-button" aria-label={swatch.name ? `Rename ${swatch.name}` : `Add name for ${label}`} onClick={event => {
                  const bounds = event.currentTarget.getBoundingClientRect();
                  close();
                  setEditor({ kind: 'name', swatch: { ...swatch, hex }, x: bounds.left + bounds.width / 2 });
                }}><span className={swatch.name ? undefined : 'name-placeholder'}>{swatch.name || 'Add Name'}</span></button>
              </div>
            </div>}
            {!drag && editor.kind === 'closed' && <>
              <span className="add-hover-start" aria-hidden="true" />
              <span className="add-hover-end" aria-hidden="true" />
            </>}
            {!drag && editor.kind === 'closed' && palette.length > 1 && ['top', 'bottom'].map(edge => <div key={edge} className={`delete-zone delete-zone-${edge}`}>
              <button className="delete-color" tabIndex={edge === 'bottom' ? -1 : undefined} aria-label={`Delete ${label}`} onClick={() => remove(swatch.id)}><Icon name="close" /></button>
            </div>)}
          </section>
          {addControl(index + 1)}
        </Fragment>;
      })}
      {rows * columns > palette.length && <div className="empty-swatch" style={{ gridColumn: `span ${rows * columns - palette.length}`, color: outline.color === 'white' ? 'black' : 'white' }}>
        {!drag && editor.kind === 'closed' && <button className="add-color" aria-label="Add color in empty space" onClick={() => add(palette.length)}><Icon name="plus" /></button>}
      </div>}
      {!drag && editor.kind === 'closed' && <div className="outline-zone outline-zone-top-left">
        <button className="outline-button" aria-label="Color information" aria-pressed={showInfo} onClick={() => setShowInfo(current => !current)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" />
          </svg>
        </button>
      </div>}
      {!drag && editor.kind === 'closed' && <div className="outline-zone outline-zone-top-right">
        <button ref={settingsButton} className="outline-button" aria-label="Menu" aria-keyshortcuts="Shift+/" aria-expanded={settingsOpen} aria-controls="settings-panel" onClick={() => setSettingsOpen(open => !open)}>
          <Icon name="menu" />
        </button>
      </div>}
      {!drag && editor.kind === 'closed' && ['bottom-left', 'bottom-right'].map(corner => {
        const action = corner.endsWith('right') ? 'color' : 'mode';
        return <div key={corner} className={`outline-zone outline-zone-${corner}`}>
          <button className="outline-button" tabIndex={0} aria-label={`${action === 'color' ? 'Change outline color' : 'Cycle outline mode'} (${outline.mode === 'none' ? 'edge to edge' : outline.mode === 'outer' ? 'outside border' : 'swatch borders'}, ${outline.color})`} aria-keyshortcuts={action === 'mode' ? 'Control+Space Meta+Space' : 'Control+Shift+Space Meta+Shift+Space'}
            onPointerDown={event => event.preventDefault()} onClick={() => activateOutline(action)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              {action === 'color' ? <path className="outline-ink" d="M12 3C10 6 5 10 5 14a7 7 0 0 0 14 0c0-4-5-8-7-11Z" />
                : <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 4v16M15 4v16" /></>}
            </svg>
          </button>
        </div>;
      })}
    </main>
    </div>
    <SettingsPanel onSavePalette={() => setBookmarks(current => new Map([...current, ...previewPalette.map(({ hex, name }) => [hex, name] as const)]))} onAddBookmark={(hex, name) => {
      close();
      commit([...previewPalette, { id: crypto.randomUUID(), hex, name }]);
    }} bookmarks={bookmarks} onRemoveBookmark={hex => setBookmarks(current => new Map([...current].filter(([key]) => key !== hex)))} palette={drag ? move(previewPalette, drag.id, target) : previewPalette} vision={vision} onVision={setVision} open={settingsOpen} settings={settings} onSave={setSettings} onClose={() => {
      setSettingsOpen(false);
      settingsButton.current?.focus();
    }} />
    </div>
    {(editor.kind === 'color' || editor.kind === 'name') && <Popup key={`${editor.kind}-${editor.swatch.id}`} x={editor.x} label={editor.kind === 'color' ? 'Color picker' : 'Rename color'} onClose={close} onCancel={dismiss}>
      {editor.kind === 'name' ? <form className="rename-form" onSubmit={event => {
        event.preventDefault();
        const name = String(new FormData(event.currentTarget).get('name')).trim();
        commit(update({ ...editor.swatch, name }));
        setBookmarks(current => current.has(editor.swatch.hex) ? new Map([...current, [editor.swatch.hex, name]]) : current);
        dismiss();
      }}><div className="popup-heading"><label htmlFor="name-input">Color Name</label><button type="button" className="icon-button" aria-label="Cancel rename" onClick={dismiss}><Icon name="close" /></button></div>
        <input id="name-input" name="name" defaultValue={editor.swatch.name} maxLength={80} />
        <button className="save-button" type="submit">Save name<Icon name="check" /></button>
      </form> : <Picker bookmarked={bookmarks.has(toHex(mode, editor.values))} onBookmark={hex => {
        setBookmarks(current => current.has(hex)
          ? new Map([...current].filter(([key]) => key !== hex))
          : new Map([...current, [hex, editor.swatch.name]]));
      }} mode={mode} values={editor.values} original={editor.swatch.hex} onAccept={values => { commit(update({ ...editor.swatch, hex: toHex(mode, values) })); dismiss(); }} notify={setNotice}
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
