import React from "react";
import { Icon } from "../utilities/Icon.jsx";

/**
 * Combobox — search and select from large option sets; supports multi-select
 * (chips). Options: [{ value, label }]. Filters client-side on the query.
 */
export function Combobox({
  label,
  options = [],
  value,
  onChange,
  placeholder = "Search…",
  multi = false,
  size = "md",
  disabled = false,
  loading = false,
  emptyText = "No results",
  id,
  className = "",
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const ref = React.useRef(null);
  const selected = multi ? (value || []) : value;

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

  const filtered = options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));
  const isSel = (v) => (multi ? selected.includes(v) : selected === v);

  const pick = (opt) => {
    if (multi) {
      const next = selected.includes(opt.value) ? selected.filter((v) => v !== opt.value) : [...selected, opt.value];
      onChange && onChange(next);
    } else {
      onChange && onChange(opt.value);
      setOpen(false);
      setQuery("");
    }
  };
  const remove = (v) => onChange && onChange(selected.filter((x) => x !== v));
  const single = !multi ? options.find((o) => o.value === selected) : null;

  return (
    <div className={["ds-field", className].filter(Boolean).join(" ")} ref={ref}>
      {label && <label className="ds-field__label" htmlFor={id}>{label}</label>}
      <div className="ds-combobox">
        <div
          className={["ds-input", `ds-input--${size}`, "ds-combobox__control", disabled ? "is-disabled" : ""].filter(Boolean).join(" ")}
          onClick={() => !disabled && setOpen(true)}
        >
          <Icon className="ds-input__icon" name="search" size={16} />
          {multi && selected.length > 0 && (
            <span className="ds-combobox__chips">
              {selected.map((v) => {
                const o = options.find((x) => x.value === v);
                return (
                  <span key={v} className="ds-chip">
                    {o ? o.label : v}
                    <button type="button" className="ds-chip__x" aria-label={`Remove ${o ? o.label : v}`} onClick={(e) => { e.stopPropagation(); remove(v); }}>
                      <Icon name="x" size={12} />
                    </button>
                  </span>
                );
              })}
            </span>
          )}
          <input
            id={id}
            className="ds-input__control"
            role="combobox"
            aria-expanded={open}
            placeholder={!multi && single ? single.label : placeholder}
            value={query}
            disabled={disabled}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
          />
          <Icon name="chevron-down" size={16} className="ds-select__caret" />
        </div>
        {open && (
          <ul className="ds-select__list" role="listbox">
            {loading ? (
              <li className="ds-select__empty">Loading…</li>
            ) : filtered.length === 0 ? (
              <li className="ds-select__empty">{emptyText}</li>
            ) : (
              filtered.map((opt) => (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={isSel(opt.value)}
                  className={["ds-select__option", isSel(opt.value) ? "is-selected" : ""].filter(Boolean).join(" ")}
                  onClick={() => pick(opt)}
                >
                  {multi && (
                    <span className={["ds-combobox__tick", isSel(opt.value) ? "is-on" : ""].join(" ")}>
                      {isSel(opt.value) && <Icon name="check" size={12} stroke={2.5} />}
                    </span>
                  )}
                  <span>{opt.label}</span>
                  {!multi && isSel(opt.value) && <Icon name="check" size={16} />}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
