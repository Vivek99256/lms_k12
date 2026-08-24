import React from "react";
import { Icon } from "../utilities/Icon.jsx";

/**
 * ButtonGroup — groups related buttons as one visual/functional unit.
 * `attached` renders a seamless segmented row; `spaced` uses inline gap.
 */
export function ButtonGroup({ children, variant = "spaced", label, className = "", ...rest }) {
  const cls = ["ds-btn-group", `ds-btn-group--${variant}`, className].filter(Boolean).join(" ");
  return (
    <div className={cls} role="group" aria-label={label} {...rest}>
      {children}
    </div>
  );
}

/**
 * SplitButton — a primary action paired with a menu of related actions.
 * Controlled-open is optional; by default it toggles its own menu.
 */
export function SplitButton({
  children,
  onClick,
  items = [],
  variant = "primary",
  size = "md",
  disabled = false,
  menuLabel = "More actions",
  className = "",
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const cls = ["ds-split-btn", `ds-split-btn--${variant}`, `ds-split-btn--${size}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls} ref={ref}>
      <button type="button" className="ds-split-btn__main" onClick={onClick} disabled={disabled}>
        {children}
      </button>
      <button
        type="button"
        className="ds-split-btn__toggle"
        aria-label={menuLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="chevron-down" size={16} />
      </button>
      {open && (
        <div className="ds-split-btn__menu" role="menu">
          {items.map((it, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              className="ds-split-btn__item"
              onClick={() => {
                setOpen(false);
                it.onClick && it.onClick();
              }}
            >
              {it.icon && <Icon name={it.icon} size={16} />}
              <span>{it.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
