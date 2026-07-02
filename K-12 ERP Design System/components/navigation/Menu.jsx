import React from "react";
import { Icon } from "../utilities/Icon.jsx";

/**
 * Menu — actions/options in a transient overlay anchored to a trigger.
 * items: [{ label, icon?, onClick?, danger?, divider?, disabled? }].
 */
export function Menu({ trigger, items = [], align = "start", className = "" }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span className="ds-menu" ref={ref}>
      <span className="ds-menu__trigger" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        {trigger}
      </span>
      {open && (
        <div className={["ds-menu__panel", `ds-menu__panel--${align}`, className].filter(Boolean).join(" ")} role="menu">
          {items.map((it, i) =>
            it.divider ? (
              <div key={`d${i}`} className="ds-menu__divider" role="separator" />
            ) : (
              <button
                key={i}
                type="button"
                role="menuitem"
                disabled={it.disabled}
                className={["ds-menu__item", it.danger ? "is-danger" : ""].filter(Boolean).join(" ")}
                onClick={() => { setOpen(false); it.onClick && it.onClick(); }}
              >
                {it.icon && <Icon name={it.icon} size={16} />}
                <span>{it.label}</span>
                {it.shortcut && <span className="ds-menu__shortcut">{it.shortcut}</span>}
              </button>
            )
          )}
        </div>
      )}
    </span>
  );
}
