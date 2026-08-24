import React from "react";
import { Icon } from "../utilities/Icon.jsx";

/**
 * SegmentedControl — switch between a few mutually-exclusive views/modes.
 * Options: [{ value, label, icon? }].
 */
export function SegmentedControl({
  options = [],
  value,
  defaultValue,
  onChange,
  size = "md",
  label,
  className = "",
}) {
  const [internal, setInternal] = React.useState(defaultValue ?? (options[0] && options[0].value));
  const current = value !== undefined ? value : internal;

  const select = (v) => {
    if (value === undefined) setInternal(v);
    onChange && onChange(v);
  };

  return (
    <div
      className={["ds-segmented", `ds-segmented--${size}`, className].filter(Boolean).join(" ")}
      role="radiogroup"
      aria-label={label}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={current === opt.value}
          className={["ds-segmented__item", current === opt.value ? "is-active" : ""].filter(Boolean).join(" ")}
          onClick={() => select(opt.value)}
        >
          {opt.icon && <Icon name={opt.icon} size={size === "sm" ? 14 : 16} />}
          {opt.label && <span>{opt.label}</span>}
        </button>
      ))}
    </div>
  );
}
