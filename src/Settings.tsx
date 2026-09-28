import { Icon } from './Picker';

const fields = [
  { key: 'minimumSwatchWidth', label: 'Minimum swatch width', min: 60, max: 1000, defaultValue: 100 },
  { key: 'windowOutlineWidth', label: 'Window outline width', min: 0, max: 120, defaultValue: undefined },
  { key: 'borderOutlineWidth', label: 'Border outline width', min: 0, max: 120, defaultValue: undefined },
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

export function SettingsPanel({ open, settings, onSave, onClose }: {
  readonly open: boolean;
  readonly settings: Settings;
  readonly onSave: (settings: Settings) => void;
  readonly onClose: () => void;
}) {
  return <aside id="settings-panel" className="settings-panel" aria-labelledby="settings-title" data-open={open} inert={!open} aria-hidden={!open}
    onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    }}>
    <form key={String(open)} className="settings-form" onSubmit={event => {
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
      <div className="popup-heading"><h2 id="settings-title">Settings</h2>
        <button type="button" className="icon-button" aria-label="Close settings" onClick={onClose}><Icon name="close" /></button>
      </div>
      {fields.map(field => <label key={field.key} className="settings-field">
        <span>{field.label}</span><span className="settings-value">
          <input name={field.key} type="number" min={field.min} max={field.max} step="1"
            required={field.defaultValue !== undefined} defaultValue={settings[field.key]} placeholder="Auto"
            onChange={event => {
              if (field.defaultValue === undefined && event.currentTarget.valueAsNumber === 0) event.currentTarget.value = '';
            }}
            autoFocus={open && field.key === 'minimumSwatchWidth'} onFocus={event => event.currentTarget.select()} />
          <span aria-hidden="true">px</span>
        </span>
      </label>)}
      <div className="settings-actions"><button type="reset">Reset defaults</button>
        <button className="save-button" type="submit">Save<Icon name="check" /></button>
      </div>
    </form>
  </aside>;
}
