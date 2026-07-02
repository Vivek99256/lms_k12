import React from "react";
import { Icon } from "../utilities/Icon.jsx";

/**
 * CommandPalette — global command / jump-to surface (Cmd/Ctrl-K). Controlled via
 * open/onClose. groups: [{ label, items: [{ id, label, icon?, keywords?, shortcut?, onSelect }] }].
 * Type to filter across label + keywords; ↑/↓ to move, ↵ to run, esc to close.
 */
export function CommandPalette({ open, onClose, groups = [], placeholder = "Search or jump to…" }) {
  const [q, setQ] = React.useState("");
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef(null);

  const filtered = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((it) => {
          if (!query) return true;
          return (it.label + " " + (it.keywords || "")).toLowerCase().includes(query);
        }),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, q]);

  const flat = React.useMemo(() => filtered.flatMap((g) => g.items), [filtered]);

  React.useEffect(() => { setActive(0); }, [q, open]);
  React.useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
    if (!open) setQ("");
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); onClose && onClose(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, flat.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
      else if (e.key === "Enter") { e.preventDefault(); const it = flat[active]; if (it) { onClose && onClose(); it.onSelect && it.onSelect(); } }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, flat, active, onClose]);

  if (!open) return null;

  let idx = -1;
  return (
    <div className="ds-cmdk__scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose && onClose(); }}>
      <div className="ds-cmdk" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="ds-cmdk__search">
          <Icon className="ds-cmdk__search-ic" name="search" size={20} />
          <input ref={inputRef} className="ds-cmdk__input" placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search commands" />
          <span className="ds-cmdk__esc">ESC</span>
        </div>
        <div className="ds-cmdk__results">
          {flat.length === 0 && <div className="ds-cmdk__empty">No results for “{q}”.</div>}
          {filtered.map((g, gi) => (
            <div key={gi} className="ds-cmdk__group">
              <div className="ds-cmdk__grouplabel">{g.label}</div>
              {g.items.map((it) => {
                idx += 1;
                const cur = idx;
                return (
                  <button
                    key={it.id || cur}
                    type="button"
                    className={["ds-cmdk__row", cur === active ? "is-active" : ""].filter(Boolean).join(" ")}
                    onMouseEnter={() => setActive(cur)}
                    onClick={() => { onClose && onClose(); it.onSelect && it.onSelect(); }}
                  >
                    {it.icon && <Icon className="ds-cmdk__row-ic" name={it.icon} size={18} />}
                    <span className="ds-cmdk__row-label">{it.label}</span>
                    {it.shortcut && <span className="ds-cmdk__kbd">{it.shortcut.map((k, i) => <kbd key={i}>{k}</kbd>)}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="ds-cmdk__footer">
          <span className="ds-cmdk__hint"><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span className="ds-cmdk__hint"><kbd>↵</kbd> select</span>
          <span className="ds-cmdk__hint"><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
