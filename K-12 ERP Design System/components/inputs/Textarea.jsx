import React from "react";
import { Icon } from "../utilities/Icon.jsx";

let _taId = 0;

/** Textarea — multi-line free text with label, helper/error, optional counter. */
export function Textarea({
  label,
  value,
  defaultValue,
  onChange,
  placeholder,
  helperText,
  errorText,
  rows = 4,
  maxLength,
  required = false,
  disabled = false,
  readOnly = false,
  showCount = false,
  id,
  className = "",
  ...rest
}) {
  const autoId = React.useMemo(() => id || `ds-ta-${++_taId}`, [id]);
  const [len, setLen] = React.useState((value ?? defaultValue ?? "").length);
  const invalid = Boolean(errorText);
  const descId = errorText ? `${autoId}-err` : helperText ? `${autoId}-help` : undefined;

  return (
    <div className={["ds-field", className].filter(Boolean).join(" ")}>
      {label && (
        <label className="ds-field__label" htmlFor={autoId}>
          {label}
          {required && <span className="ds-field__req" aria-hidden="true"> *</span>}
        </label>
      )}
      <div className={["ds-input", "ds-input--textarea", invalid ? "is-invalid" : "", disabled ? "is-disabled" : ""].filter(Boolean).join(" ")}>
        <textarea
          id={autoId}
          className="ds-input__control"
          rows={rows}
          value={value}
          defaultValue={defaultValue}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={descId}
          onChange={(e) => {
            setLen(e.target.value.length);
            onChange && onChange(e);
          }}
          {...rest}
        />
      </div>
      <div className="ds-field__foot">
        {errorText ? (
          <p className="ds-field__msg ds-field__msg--error" id={descId}>
            <Icon name="alert-circle" size={13} /> {errorText}
          </p>
        ) : helperText ? (
          <p className="ds-field__msg" id={descId}>{helperText}</p>
        ) : <span />}
        {(showCount || maxLength) && (
          <span className="ds-field__count">{len}{maxLength ? `/${maxLength}` : ""}</span>
        )}
      </div>
    </div>
  );
}
