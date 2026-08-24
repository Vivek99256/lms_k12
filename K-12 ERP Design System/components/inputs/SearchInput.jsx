import React from "react";
import { Icon } from "../utilities/Icon.jsx";

/**
 * SearchInput — query field for filtering/finding. Shows a leading search
 * icon, a clear button when non-empty, and an optional loading spinner.
 */
export function SearchInput({
  value,
  defaultValue,
  onChange,
  onClear,
  placeholder = "Search…",
  size = "md",
  loading = false,
  disabled = false,
  ariaLabel = "Search",
  className = "",
  ...rest
}) {
  const [internal, setInternal] = React.useState(defaultValue ?? "");
  const val = value !== undefined ? value : internal;
  const hasVal = String(val || "").length > 0;

  const handle = (e) => {
    if (value === undefined) setInternal(e.target.value);
    onChange && onChange(e);
  };
  const clear = () => {
    if (value === undefined) setInternal("");
    onClear && onClear();
  };

  return (
    <div className={["ds-input", "ds-search", `ds-input--${size}`, disabled ? "is-disabled" : "", className].filter(Boolean).join(" ")}>
      <Icon className="ds-input__icon" name="search" size={16} />
      <input
        className="ds-input__control"
        type="search"
        role="searchbox"
        aria-label={ariaLabel}
        value={val}
        placeholder={placeholder}
        disabled={disabled}
        onChange={handle}
        {...rest}
      />
      {loading && <span className="ds-search__spinner" aria-hidden="true" />}
      {!loading && hasVal && (
        <button type="button" className="ds-input__affix-btn" aria-label="Clear search" onClick={clear}>
          <Icon name="x" size={15} />
        </button>
      )}
    </div>
  );
}
