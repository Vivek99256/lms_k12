import React from "react";
import { Icon } from "../utilities/Icon.jsx";
import { Checkbox } from "../selection/Checkbox.jsx";

/**
 * DataTable — sortable, selectable, sticky-header table for structured data.
 * columns: [{ key, header, align?, sortable?, width?, render?(row) }]
 * Handles empty and loading states. Sorting is controlled via sortKey/sortDir.
 */
export function DataTable({
  columns = [],
  data = [],
  rowKey = "id",
  selectable = false,
  selectedKeys = [],
  onSelectionChange,
  sortKey,
  sortDir = "asc",
  onSort,
  onRowClick,
  loading = false,
  emptyTitle = "No records",
  emptyText = "There's nothing to show here yet.",
  stickyHeader = true,
  className = "",
}) {
  const keyOf = (row, i) => (typeof rowKey === "function" ? rowKey(row) : row[rowKey] ?? i);
  const allKeys = data.map((r, i) => keyOf(r, i));
  const allSelected = selectable && data.length > 0 && allKeys.every((k) => selectedKeys.includes(k));
  const someSelected = selectable && selectedKeys.length > 0 && !allSelected;

  const toggleAll = () => onSelectionChange && onSelectionChange(allSelected ? [] : allKeys);
  const toggleRow = (k) =>
    onSelectionChange && onSelectionChange(selectedKeys.includes(k) ? selectedKeys.filter((x) => x !== k) : [...selectedKeys, k]);

  const handleSort = (col) => {
    if (!col.sortable || !onSort) return;
    const nextDir = sortKey === col.key && sortDir === "asc" ? "desc" : "asc";
    onSort(col.key, nextDir);
  };

  const cls = ["ds-table-wrap", stickyHeader ? "ds-table-wrap--sticky" : "", className].filter(Boolean).join(" ");
  const colCount = columns.length + (selectable ? 1 : 0);

  return (
    <div className={cls}>
      <table className="ds-table">
        <thead>
          <tr>
            {selectable && (
              <th className="ds-table__cell ds-table__cell--check" scope="col">
                <Checkbox checked={allSelected} indeterminate={someSelected} onChange={toggleAll} aria-label="Select all rows" />
              </th>
            )}
            {columns.map((col) => {
              const sorted = sortKey === col.key;
              return (
                <th
                  key={col.key}
                  scope="col"
                  className={["ds-table__cell ds-table__th", col.align === "end" ? "ds-table__cell--end" : "", col.sortable ? "is-sortable" : ""].filter(Boolean).join(" ")}
                  style={col.width ? { width: col.width } : undefined}
                  aria-sort={sorted ? (sortDir === "asc" ? "ascending" : "descending") : col.sortable ? "none" : undefined}
                  onClick={() => handleSort(col)}
                >
                  <span className="ds-table__th-inner">
                    {col.header}
                    {col.sortable && (
                      <Icon
                        name={sorted ? (sortDir === "asc" ? "arrow-up" : "arrow-down") : "chevrons-up-down"}
                        size={14}
                        className={sorted ? "ds-table__sort is-active" : "ds-table__sort"}
                      />
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 6 }).map((_, r) => (
              <tr key={r} className="ds-table__row">
                {selectable && <td className="ds-table__cell ds-table__cell--check"><span className="ds-skel ds-skel--text" style={{ width: 16 }} /></td>}
                {columns.map((c) => (
                  <td key={c.key} className="ds-table__cell"><span className="ds-skel ds-skel--text" style={{ width: `${40 + ((r + c.key.length) % 5) * 12}%` }} /></td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td className="ds-table__empty" colSpan={colCount}>
                <div className="ds-table__empty-inner">
                  <Icon name="inbox" size={28} />
                  <p className="ds-table__empty-title">{emptyTitle}</p>
                  <p className="ds-table__empty-text">{emptyText}</p>
                </div>
              </td>
            </tr>
          ) : (
            data.map((row, i) => {
              const k = keyOf(row, i);
              const isSel = selectedKeys.includes(k);
              return (
                <tr
                  key={k}
                  className={["ds-table__row", isSel ? "is-selected" : "", onRowClick ? "is-clickable" : ""].filter(Boolean).join(" ")}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {selectable && (
                    <td className="ds-table__cell ds-table__cell--check" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={isSel} onChange={() => toggleRow(k)} aria-label={`Select row ${i + 1}`} />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className={["ds-table__cell", col.align === "end" ? "ds-table__cell--end ds-num" : ""].filter(Boolean).join(" ")}>
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
