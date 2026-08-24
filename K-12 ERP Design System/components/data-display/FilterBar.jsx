import React from "react";
import { Icon } from "../utilities/Icon.jsx";

/**
 * FilterBar — a horizontal bar hosting search, filter controls, and active
 * filter chips with clear-all. Layout container: pass controls as children
 * and active filters via `activeFilters` (rendered as removable chips).
 */
export function FilterBar({
  children,
  activeFilters = [],
  onClearAll,
  onRemoveFilter,
  resultCount,
  trailing,
  className = "",
}) {
  const hasActive = activeFilters.length > 0;
  return (
    <div className={["ds-filter-bar", className].filter(Boolean).join(" ")} role="search">
      <div className="ds-filter-bar__controls">
        {children}
        {trailing && <div className="ds-filter-bar__trailing">{trailing}</div>}
      </div>
      {(hasActive || resultCount != null) && (
        <div className="ds-filter-bar__active">
          {resultCount != null && <span className="ds-filter-bar__count">{resultCount}</span>}
          {activeFilters.map((f, i) => (
            <span key={f.id ?? i} className="ds-chip ds-chip--filter">
              {f.label}
              <button type="button" className="ds-chip__x" aria-label={`Remove ${f.label}`} onClick={() => onRemoveFilter && onRemoveFilter(f)}>
                <Icon name="x" size={12} />
              </button>
            </span>
          ))}
          {hasActive && (
            <button type="button" className="ds-filter-bar__clear" onClick={onClearAll}>
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
