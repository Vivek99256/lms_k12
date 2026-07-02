import React from "react";
import { Icon } from "../utilities/Icon.jsx";

let _selId = 0;

/**
 * Select — choose one value from a closed list. Custom listbox popover with
 * keyboard open/close. Options: [{ value, label, disabled? }].
 */
export function Select({
  label,
  options = [],
  value,
  defaultValue,
  onChange,
  placeholder = "Select…",
  size = "md",
  disabled = false,
  errorText,
  required = false,
  id,
  className = "",
}) {
  const autoId = React.useMemo(() => id || `ds-sel-${++_selId}`, [id]);
  const [open, setOpen] = React.useState(false);
  const [internal, setInternal] = React.useState(defaultValue);
  const current = value !== undefined ? value : internal;
  const ref = React.useRef(null);
  const selected = options.find((o) => o.value === current);

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

  const pick = (opt) => {
    if (opt.disabled) return;
    if (value === undefined) setInternal(opt.value);
    onChange && onChange(opt.value);
    setOpen(false);
  };

  return (
    <div className={["ds-field", className].filter(Boolean).join(" ")} ref={ref}>
      {label && (
        <label className="ds-field__label" htmlFor={autoId}>
          {label}{required && <span className="ds-field__req" aria-hidden="true"> *</span>}
        </label>
      )}
      <div className="ds-select">
        <button
          id={autoId}
          type="button"
          className={["ds-input", `ds-input--${size}`, "ds-select__trigger", errorText ? "is-invalid" : "", disabled ? "is-disabled" : ""].filter(Boolean).join(" ")}
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
        >
          <span className={selected ? "ds-select__value" : "ds-select__placeholder"}>
            {selected ? selected.label : placeholder}
          </span>
          <Icon name="chevron-down" size={16} className="ds-select__caret" />
        </button>
        {open && (
          <ul className="ds-select__list" role="listbox" aria-label={label}>
            {options.map((opt) => (
              <li
                key={opt.value}
                role="option"
                aria-selected={opt.value === current}
                className={["ds-select__option", opt.value === current ? "is-selected" : "", opt.disabled ? "is-disabled" : ""].filter(Boolean).join(" ")}
                onClick={() => pick(opt)}
              >
                <span>{opt.label}</span>
                {opt.value === current && <Icon name="check" size={16} />}
              </li>
            ))}
          </ul>
        )}
      </div>
      {errorText && (
        <p className="ds-field__msg ds-field__msg--error">
          <Icon name="alert-circle" size={13} /> {errorText}
        </p>
      )}
    </div>
  );
}
