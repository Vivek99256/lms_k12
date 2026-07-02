import React from "react";

let _rgId = 0;

/**
 * RadioGroup — choose exactly one option from a small mutually-exclusive set.
 * Options: [{ value, label, description?, disabled? }]. Card variant renders
 * each option as a selectable card.
 */
export function RadioGroup({
  name,
  label,
  options = [],
  value,
  defaultValue,
  onChange,
  orientation = "vertical",
  variant = "default",
  disabled = false,
  className = "",
}) {
  const groupName = React.useMemo(() => name || `ds-rg-${++_rgId}`, [name]);
  const [internal, setInternal] = React.useState(defaultValue);
  const current = value !== undefined ? value : internal;

  const select = (v) => {
    if (value === undefined) setInternal(v);
    onChange && onChange(v);
  };

  return (
    <div
      className={["ds-radio-group", `ds-radio-group--${orientation}`, `ds-radio-group--${variant}`, className].filter(Boolean).join(" ")}
      role="radiogroup"
      aria-label={label}
    >
      {options.map((opt) => {
        const checked = current === opt.value;
        const od = disabled || opt.disabled;
        return (
          <label key={opt.value} className={["ds-radio", checked ? "is-checked" : "", od ? "is-disabled" : ""].filter(Boolean).join(" ")}>
            <input
              type="radio"
              className="ds-radio__input"
              name={groupName}
              value={opt.value}
              checked={checked}
              disabled={od}
              onChange={() => select(opt.value)}
            />
            <span className="ds-radio__dot" aria-hidden="true" />
            <span className="ds-radio__text">
              <span className="ds-radio__label">{opt.label}</span>
              {opt.description && <span className="ds-radio__desc">{opt.description}</span>}
            </span>
          </label>
        );
      })}
    </div>
  );
}
