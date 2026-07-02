import React from "react";
import { Icon } from "../utilities/Icon.jsx";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function fmt(d) {
  if (!d) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}
function sameDay(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * DatePicker — a text field paired with a keyboard-navigable month calendar
 * popover. Controlled via `value`/`onChange` (JS Date) or uncontrolled.
 */
export function DatePicker({
  label,
  value,
  onChange,
  placeholder = "dd/mm/yyyy",
  size = "md",
  disabled = false,
  errorText,
  required = false,
  id,
  className = "",
}) {
  const [open, setOpen] = React.useState(false);
  const [sel, setSel] = React.useState(value || null);
  const [view, setView] = React.useState(value || new Date());
  const ref = React.useRef(null);
  const current = value !== undefined ? value : sel;

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

  const pick = (d) => {
    if (value === undefined) setSel(d);
    onChange && onChange(d);
    setOpen(false);
  };

  const y = view.getFullYear(), m = view.getMonth();
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(y, m, d));
  const today = new Date();

  return (
    <div className={["ds-field", className].filter(Boolean).join(" ")} ref={ref}>
      {label && (
        <label className="ds-field__label" htmlFor={id}>
          {label}{required && <span className="ds-field__req" aria-hidden="true"> *</span>}
        </label>
      )}
      <div className="ds-datepicker">
        <div
          className={["ds-input", `ds-input--${size}`, errorText ? "is-invalid" : "", disabled ? "is-disabled" : ""].filter(Boolean).join(" ")}
          onClick={() => !disabled && setOpen((o) => !o)}
        >
          <Icon className="ds-input__icon" name="calendar" size={16} />
          <input
            id={id}
            className="ds-input__control"
            readOnly
            placeholder={placeholder}
            value={fmt(current)}
            disabled={disabled}
            aria-haspopup="dialog"
            aria-expanded={open}
          />
        </div>
        {open && (
          <div className="ds-calendar" role="dialog" aria-label="Choose date">
            <div className="ds-calendar__head">
              <button type="button" className="ds-icon-btn ds-icon-btn--sm" aria-label="Previous month" onClick={() => setView(new Date(y, m - 1, 1))}>
                <Icon name="chevron-left" size={16} />
              </button>
              <span className="ds-calendar__title">{MONTHS[m]} {y}</span>
              <button type="button" className="ds-icon-btn ds-icon-btn--sm" aria-label="Next month" onClick={() => setView(new Date(y, m + 1, 1))}>
                <Icon name="chevron-right" size={16} />
              </button>
            </div>
            <div className="ds-calendar__grid ds-calendar__dow">
              {DOW.map((d) => <span key={d} className="ds-calendar__dowcell">{d}</span>)}
            </div>
            <div className="ds-calendar__grid">
              {cells.map((d, i) =>
                d ? (
                  <button
                    key={i}
                    type="button"
                    className={["ds-calendar__day", sameDay(d, current) ? "is-selected" : "", sameDay(d, today) ? "is-today" : ""].filter(Boolean).join(" ")}
                    onClick={() => pick(d)}
                  >
                    {d.getDate()}
                  </button>
                ) : (
                  <span key={i} />
                )
              )}
            </div>
          </div>
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
