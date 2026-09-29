import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Icon } from './Picker';
import { Accessibility } from './Accessibility';
import { Bookmarks } from './Bookmarks';
import { Exports } from './Exports';
import type { VisionMode } from './color';
import type { Palette } from './palette';

const touchMedia = window.matchMedia('(hover: none)');
const subscribeToTouch = (notify: () => void) => {
  touchMedia.addEventListener('change', notify);
  return () => touchMedia.removeEventListener('change', notify);
};

const tabs = [
  { id: 'settings', label: 'Settings', icon: 'settings' },
  { id: 'accessibility', label: 'Accessibility', icon: 'eye' },
  { id: 'bookmarks', label: 'Bookmarks', icon: 'bookmark' },
  { id: 'export', label: 'Export', icon: 'export' },
  { id: 'keyboard', label: 'Keyboard shortcuts', icon: 'keyboard' },
] as const;

const fields = [
  { key: 'minimumSwatchWidth', label: 'Minimum swatch width', min: 60, max: 1000, defaultValue: 100 },
  { key: 'windowOutlineWidth', label: 'Window outline width', min: 0, max: 120, defaultValue: undefined },
  { key: 'borderOutlineWidth', label: 'Border outline width', min: 0, max: 120, defaultValue: undefined },
] as const;

const keyLabels = /^(Mac|iPhone|iPad|iPod)/.test(navigator.platform)
  ? { modifier: '⌘', alt: '⌥', enter: 'Return', delete: 'Delete', redo: '⌘ + Shift + Z' }
  : { modifier: 'Ctrl', alt: 'Alt', enter: 'Enter', delete: 'Delete / Backspace', redo: 'Ctrl + Shift + Z; Ctrl + Y' };

const shortcuts = [
  ['App', [
    ['Toggle sidebar', 'Shift + /'],
    ['Cycle outline mode', `${keyLabels.modifier} + Space`],
    ['Toggle outline color', `${keyLabels.modifier} + Shift + Space`],
    ['Toggle fullscreen', `${keyLabels.alt} + ${keyLabels.enter}`],
    ['Exit fullscreen', 'Esc'],
  ]],
  ['Palette', [
    ['Focus selected swatch', 'Tab'],
    ['Focus mouse selection', `Space / ${keyLabels.enter}`],
    ['Previous / next swatch', '← / →'],
    ['Cycle swatch, hex, and name', '↑ / ↓'],
    ['Move selected swatch', `${keyLabels.modifier} / ${keyLabels.alt} + ← / →`],
    ['Delete selected swatch', keyLabels.delete],
    ['Add swatch to the right', 'Shift + = (+)'],
    ['Edit focused color', `Space / ${keyLabels.enter}`],
    ['Open focused hex or name', `Space / ${keyLabels.enter}`],
    ['Copy selected hex', `${keyLabels.modifier} + C`],
    ['Paste color to the right', `${keyLabels.modifier} + V`],
    ['Undo', `${keyLabels.modifier} + Z`],
    ['Redo', keyLabels.redo],
    ['Clear focus outline', 'Esc'],
  ]],
  ['Color picker', [
    ['Previous / next value or mode', '↑ / ↓'],
    ['Adjust slider by 1', '← / →'],
    ['Adjust slider by 10', `Shift / ${keyLabels.modifier} + ← / →`],
    ['Adjust slider by 0.1', `${keyLabels.alt} + ← / →`],
    ['Type a slider value', '0–9'],
    ['Explore slider shades', 'Space'],
    ['Choose mode', keyLabels.enter],
  ]],
  ['Shades', [
    ['Previous / next shade', '↑ / ↓ / ← / →'],
    ['First / last shade', 'Home / End'],
    ['Choose shade', `Space / ${keyLabels.enter}`],
  ]],
  ['Editing', [
    ['Accept color or name', keyLabels.enter],
    ['Discard color or name', 'Esc'],
  ]],
  ['Sidebar', [
    ['Previous / next tab', '← / →'],
    ['First / last tab', 'Home / End'],
    ['Save settings', keyLabels.enter],
    ['Close sidebar', 'Esc'],
  ]],
] as const;

export type Settings = Readonly<{
  minimumSwatchWidth: number;
  windowOutlineWidth?: number;
  borderOutlineWidth?: number;
}>;

export function readSettings(): Settings {
  try {
    const stored = JSON.parse(localStorage.getItem('palette:settings') ?? '{}');
    return Object.fromEntries(fields.map(field => {
      const value = stored?.[field.key];
      return [field.key, Number.isInteger(value) && value > 0 && value >= field.min && value <= field.max ? value : field.defaultValue];
    })) as Settings;
  } catch {
    return { minimumSwatchWidth: fields[0].defaultValue };
  }
}

export function SettingsPanel({ open, settings, onSave, onClose, palette, vision, onVision, bookmarks, onRemoveBookmark, onAddBookmark, onSavePalette }: {
  readonly bookmarks: ReadonlyMap<string, string>;
  readonly onRemoveBookmark: (hex: string) => void;
  readonly onAddBookmark: (hex: string, name: string) => void;
  readonly onSavePalette: () => void;
  readonly palette: Palette;
  readonly vision: VisionMode;
  readonly onVision: (mode: VisionMode) => void;
  readonly open: boolean;
  readonly settings: Settings;
  readonly onSave: (settings: Settings) => void;
  readonly onClose: () => void;
}) {
  const touch = useSyncExternalStore(subscribeToTouch, () => touchMedia.matches);
  const visibleTabs = tabs.filter(item => !touch || item.id !== 'keyboard');
  const [preferredTab, setTab] = useState<typeof tabs[number]['id']>(() => {
    try {
      const stored = localStorage.getItem('palette:sidebar-tab');
      return tabs.find(item => item.id === stored)?.id ?? 'settings';
    } catch {
      return 'settings';
    }
  });
  const tab = visibleTabs.find(item => item.id === preferredTab)?.id ?? 'settings';
  useEffect(() => {
    try {
      localStorage.setItem('palette:sidebar-tab', preferredTab);
    } catch {
      // Tabs still work when browser storage is blocked.
    }
  }, [preferredTab]);
  const panel = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (open) panel.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
  }, [open, touch]);
  return <aside ref={panel} id="settings-panel" className="settings-panel" aria-label="Palette menu" data-open={open} inert={!open} aria-hidden={!open}
    onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    }}>
    <div className="sidebar-content">
      <header className="sidebar-header">
        <div className="sidebar-tabs" role="tablist" aria-label="Sidebar" onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const index = visibleTabs.findIndex(item => item.id === tab);
          const next = visibleTabs[event.key === 'Home' ? 0 : event.key === 'End' ? visibleTabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + visibleTabs.length) % visibleTabs.length].id;
          setTab(next);
          event.currentTarget.querySelector<HTMLElement>(`#${next}-tab`)?.focus();
        }}>
          {visibleTabs.map(item => <button key={item.id} id={`${item.id}-tab`} type="button" role="tab"
            aria-label={item.label} title={item.label}
            aria-controls={`${item.id}-content`} aria-selected={tab === item.id} tabIndex={tab === item.id ? 0 : -1} onClick={() => setTab(item.id)}>
            <Icon name={item.icon} />
          </button>)}
        </div>
        <button type="button" className="icon-button" aria-label="Close menu" onClick={onClose}><Icon name="close" /></button>
      </header>
      <div className="sidebar-body">
        <form key={String(open)} id="settings-content" role="tabpanel" aria-labelledby="settings-tab" hidden={tab !== 'settings'} className="settings-form" onSubmit={event => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          onSave(Object.fromEntries(fields.map(field => {
            const value = data.get(field.key);
            return [field.key, value === '' ? field.defaultValue : Number(value)];
          })) as Settings);
        }} onReset={event => {
          event.preventDefault();
          fields.forEach(field => {
            const input = event.currentTarget.elements.namedItem(field.key);
            if (input instanceof HTMLInputElement) input.value = String(field.defaultValue ?? '');
          });
        }}>
          <h2>Settings</h2>
          {fields.map(field => <label key={field.key} className="settings-field">
            <span>{field.label}</span><span className="settings-value">
              <input name={field.key} type="number" min={field.min} max={field.max} step="1"
                required={field.defaultValue !== undefined} defaultValue={settings[field.key]} placeholder="Auto"
                onChange={event => {
                  if (field.defaultValue === undefined && event.currentTarget.valueAsNumber === 0) event.currentTarget.value = '';
                }}
                onFocus={event => event.currentTarget.select()} />
              <span aria-hidden="true">px</span>
            </span>
          </label>)}
          <div className="settings-actions"><button type="reset">Reset</button>
            <button className="save-button" type="submit">Save<Icon name="check" /></button>
          </div>
        </form>
        <section id="bookmarks-content" role="tabpanel" aria-labelledby="bookmarks-tab" hidden={tab !== 'bookmarks'} tabIndex={0} className="bookmarks-panel">
          <Bookmarks bookmarks={bookmarks} onRemove={onRemoveBookmark} onAdd={onAddBookmark} onSavePalette={onSavePalette} />
        </section>
        <section id="accessibility-content" role="tabpanel" aria-labelledby="accessibility-tab" hidden={tab !== 'accessibility'} className="accessibility-panel">
          <Accessibility palette={palette} vision={vision} onVision={onVision} />
        </section>
        <section id="export-content" role="tabpanel" aria-labelledby="export-tab" hidden={tab !== 'export'} className="export-panel">
          <Exports palette={palette} />
        </section>
        <section id="keyboard-content" role="tabpanel" aria-labelledby="keyboard-tab" hidden={tab !== 'keyboard'} tabIndex={0} className="shortcut-list">
          <h2>Keyboard shortcuts</h2>
          {shortcuts.map(([group, entries]) => <section key={group}>
            <h3>{group}</h3>
            <dl>{entries.map(([action, keys]) => <div key={action}><dt>{action}</dt><dd><kbd>{keys}</kbd></dd></div>)}</dl>
          </section>)}
        </section>
      </div>
    </div>
  </aside>;
}
