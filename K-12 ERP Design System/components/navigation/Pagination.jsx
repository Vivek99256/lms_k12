import React from "react";
import { Icon } from "../utilities/Icon.jsx";

/**
 * Pagination — navigate bounded pages of a large record set. Shows page-size
 * select, range summary, and numbered controls with prev/next.
 */
export function Pagination({
  page = 1,
  pageCount = 1,
  pageSize = 25,
  total,
  pageSizeOptions = [10, 25, 50, 100],
  onPageChange,
  onPageSizeChange,
  className = "",
}) {
  const go = (p) => p >= 1 && p <= pageCount && onPageChange && onPageChange(p);
  // compute a compact window of page numbers
  const nums = [];
  const add = (n) => nums.push(n);
  if (pageCount <= 7) {
    for (let i = 1; i <= pageCount; i++) add(i);
  } else {
    add(1);
    if (page > 3) add("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(pageCount - 1, page + 1); i++) add(i);
    if (page < pageCount - 2) add("…");
    add(pageCount);
  }
  const from = (page - 1) * pageSize + 1;
  const to = total != null ? Math.min(page * pageSize, total) : page * pageSize;

  return (
    <nav className={["ds-pagination", className].filter(Boolean).join(" ")} aria-label="Pagination">
      <div className="ds-pagination__meta">
        {total != null && <span className="ds-pagination__range">{from}–{to} of {total}</span>}
        {onPageSizeChange && (
          <label className="ds-pagination__size">
            <span>Rows</span>
            <select
              className="ds-pagination__select"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              {pageSizeOptions.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
      </div>
      <div className="ds-pagination__controls">
        <button type="button" className="ds-pagination__btn" aria-label="Previous page" disabled={page <= 1} onClick={() => go(page - 1)}>
          <Icon name="chevron-left" size={16} />
        </button>
        {nums.map((n, i) =>
          n === "…" ? (
            <span key={`e${i}`} className="ds-pagination__ellipsis">…</span>
          ) : (
            <button
              key={n}
              type="button"
              className={["ds-pagination__btn", n === page ? "is-active" : ""].filter(Boolean).join(" ")}
              aria-current={n === page ? "page" : undefined}
              onClick={() => go(n)}
            >
              {n}
            </button>
          )
        )}
        <button type="button" className="ds-pagination__btn" aria-label="Next page" disabled={page >= pageCount} onClick={() => go(page + 1)}>
          <Icon name="chevron-right" size={16} />
        </button>
      </div>
    </nav>
  );
}
