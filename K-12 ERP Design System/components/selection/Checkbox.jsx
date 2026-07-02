import React from "react";
import { Icon } from "../utilities/Icon.jsx";

let _cbId = 0;

/** Checkbox — boolean toggle or row/item selector; supports indeterminate. */
export function Checkbox({
  label,
  checked,
  defaultChecked,
  indeterminate = false,
  onChange,
  disabled = false,
  size = "md",
  description,
  id,
  className = "",
  ...rest
}) {
  const autoId = React.useMemo(() => id || `ds-cb-${++_cbId}`, [id]);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <label className={["ds-check", `ds-check--${size}`, disabled ? "is-disabled" : "", className].filter(Boolean).join(" ")} htmlFor={autoId}>
      <span className="ds-check__box">
        <input
          ref={ref}
          id={autoId}
          type="checkbox"
          className="ds-check__input"
          checked={checked}
          defaultChecked={defaultChecked}
          disabled={disabled}
          onChange={onChange}
          {...rest}
        />
        <span className="ds-check__mark" aria-hidden="true">
          <Icon name={indeterminate ? "minus" : "check"} size={size === "sm" ? 12 : 14} stroke={2.5} />
        </span>
      </span>
      {(label || description) && (
        <span className="ds-check__text">
          {label && <span className="ds-check__label">{label}</span>}
          {description && <span className="ds-check__desc">{description}</span>}
        </span>
      )}
    </label>
  );
}
