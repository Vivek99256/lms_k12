import React from "react";

let _tgId = 0;

/** Toggle — switch a setting on/off with immediate meaning (switch role). */
export function Toggle({
  label,
  checked,
  defaultChecked,
  onChange,
  disabled = false,
  size = "md",
  description,
  id,
  className = "",
}) {
  const autoId = React.useMemo(() => id || `ds-tg-${++_tgId}`, [id]);
  const [internal, setInternal] = React.useState(defaultChecked || false);
  const on = checked !== undefined ? checked : internal;

  const toggle = (e) => {
    if (checked === undefined) setInternal(e.target.checked);
    onChange && onChange(e.target.checked);
  };

  return (
    <label className={["ds-toggle", `ds-toggle--${size}`, disabled ? "is-disabled" : "", className].filter(Boolean).join(" ")} htmlFor={autoId}>
      <span className="ds-toggle__switch">
        <input
          id={autoId}
          type="checkbox"
          role="switch"
          className="ds-toggle__input"
          checked={on}
          disabled={disabled}
          onChange={toggle}
          aria-checked={on}
        />
        <span className="ds-toggle__track" aria-hidden="true">
          <span className="ds-toggle__thumb" />
        </span>
      </span>
      {(label || description) && (
        <span className="ds-toggle__text">
          {label && <span className="ds-toggle__label">{label}</span>}
          {description && <span className="ds-toggle__desc">{description}</span>}
        </span>
      )}
    </label>
  );
}
