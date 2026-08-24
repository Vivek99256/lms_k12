import React from "react";
import { Icon } from "../utilities/Icon.jsx";

let _tfId = 0;

/**
 * TextField — single-line input with label, helper text, validation and
 * optional leading/trailing icons. `type=password` adds a reveal toggle.
 */
export function TextField({
  label,
  value,
  defaultValue,
  onChange,
  type = "text",
  placeholder,
  helperText,
  errorText,
  size = "md",
  required = false,
  disabled = false,
  readOnly = false,
  iconStart,
  iconEnd,
  id,
  className = "",
  ...rest
}) {
  const [reveal, setReveal] = React.useState(false);
  const autoId = React.useMemo(() => id || `ds-tf-${++_tfId}`, [id]);
  const invalid = Boolean(errorText);
  const isPassword = type === "password";
  const effectiveType = isPassword ? (reveal ? "text" : "password") : type;
  const descId = errorText ? `${autoId}-err` : helperText ? `${autoId}-help` : undefined;

  const cls = ["ds-field", className].filter(Boolean).join(" ");
  const wrapCls = [
    "ds-input",
    `ds-input--${size}`,
    invalid ? "is-invalid" : "",
    disabled ? "is-disabled" : "",
    readOnly ? "is-readonly" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls}>
      {label && (
        <label className="ds-field__label" htmlFor={autoId}>
          {label}
          {required && <span className="ds-field__req" aria-hidden="true"> *</span>}
        </label>
      )}
      <div className={wrapCls}>
        {iconStart && <Icon className="ds-input__icon" name={iconStart} size={16} />}
        <input
          id={autoId}
          className="ds-input__control"
          type={effectiveType}
          value={value}
          defaultValue={defaultValue}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={descId}
          {...rest}
        />
        {isPassword ? (
          <button
            type="button"
            className="ds-input__affix-btn"
            aria-label={reveal ? "Hide password" : "Show password"}
            onClick={() => setReveal((r) => !r)}
          >
            <Icon name={reveal ? "eye-off" : "eye"} size={16} />
          </button>
        ) : (
          iconEnd && <Icon className="ds-input__icon" name={iconEnd} size={16} />
        )}
      </div>
      {errorText ? (
        <p className="ds-field__msg ds-field__msg--error" id={descId}>
          <Icon name="alert-circle" size={13} /> {errorText}
        </p>
      ) : (
        helperText && (
          <p className="ds-field__msg" id={descId}>
            {helperText}
          </p>
        )
      )}
    </div>
  );
}
