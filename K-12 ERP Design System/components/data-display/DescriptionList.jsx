import React from "react";

/**
 * DescriptionList — labeled read-only field values for a record. Items:
 * [{ term, value }]. `two-column` lays term/value side by side; `stacked`
 * puts value under term. Empty values render an em-dash, not blank.
 */
export function DescriptionList({ items = [], variant = "two-column", columns = 1, className = "" }) {
  const cls = ["ds-dl", `ds-dl--${variant}`, className].filter(Boolean).join(" ");
  const style = columns > 1 ? { "--_cols": columns } : undefined;
  return (
    <dl className={cls} style={style}>
      {items.map((it, i) => (
        <div className="ds-dl__row" key={i}>
          <dt className="ds-dl__term">{it.term}</dt>
          <dd className="ds-dl__value">{it.value == null || it.value === "" ? <span className="ds-dl__empty">—</span> : it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
