import { useEffect, useState } from 'react';
import { ink } from './color';
import { Icon } from './Picker';

export function useBookmarks(notify: (message: string) => void) {
  const [bookmarks, setBookmarks] = useState<ReadonlyMap<string, string>>(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem('palette:bookmarks') ?? '[]');
      if (!Array.isArray(stored)) return new Map();
      return new Map(stored.flatMap(entry =>
        Array.isArray(entry) && entry.length === 2 && typeof entry[0] === 'string' && /^[\da-f]{6}$/i.test(entry[0])
          && typeof entry[1] === 'string'
          ? [[entry[0].toUpperCase(), entry[1].trim().slice(0, 80)] as const] : []));
    } catch {
      return new Map();
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('palette:bookmarks', JSON.stringify([...bookmarks]));
    } catch {
      notify('Bookmarks could not be saved in this browser.');
    }
  }, [bookmarks, notify]);
  return [bookmarks, setBookmarks] as const;
}

export function Bookmarks({ bookmarks, onRemove, onAdd }: {
  readonly bookmarks: ReadonlyMap<string, string>;
  readonly onRemove: (hex: string) => void;
  readonly onAdd: (hex: string, name: string) => void;
}) {
  return <>
    <h2>Bookmarks</h2>
    {bookmarks.size ? <ul className="bookmark-grid">
      {[...bookmarks].map(([hex, name]) => <li key={hex} style={{ background: `#${hex}`, color: ink(hex) }}>
        <button type="button" className="bookmark-add" aria-label={`Add ${name ? `${name} ` : ''}${hex} to palette`} onClick={() => onAdd(hex, name)}>
          <span className="bookmark-hex">{hex}</span>
          <span className="bookmark-name" title={name}>{name}</span>
        </button>
        <button type="button" className="delete-color bookmark-remove" aria-label={`Remove bookmark ${name ? `${name} ` : ''}${hex}`} onClick={event => {
          const item = event.currentTarget.closest('li');
          const neighbor = item?.nextElementSibling ?? item?.previousElementSibling;
          const focus = neighbor?.querySelector<HTMLButtonElement>('.bookmark-remove') ?? event.currentTarget.closest<HTMLElement>('[role="tabpanel"]');
          onRemove(hex);
          focus?.focus();
        }}><Icon name="close" /></button>
      </li>)}
    </ul> : <p className="bookmarks-empty">No bookmarks</p>}
  </>;
}
