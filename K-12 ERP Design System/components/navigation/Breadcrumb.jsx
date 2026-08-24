import React from "react";
import { Icon } from "../utilities/Icon.jsx";
import { Menu } from "./Menu.jsx";

/**
 * Breadcrumb — location trail with a path back. items: [{ label, href?, onClick?, icon? }].
 * Last item is the current page (aria-current). When the trail exceeds maxItems,
 * the middle collapses into an overflow menu (first + … + last items kept).
 */
export function Breadcrumb({ items = [], maxItems = 4, className = "" }) {
  const renderCrumb = (it, last) =>
    last ? (
      <span className="ds-breadcrumb__current" aria-current="page">
        {it.icon && <Icon name={it.icon} size={14} aria-hidden="true" />}
        {it.label}
      </span>
    ) : (
      <a
        className="ds-breadcrumb__link"
        href={it.href || "#"}
        onClick={it.onClick ? (e) => { e.preventDefault(); it.onClick(); } : undefined}
      >
        {it.icon && <Icon name={it.icon} size={14} aria-hidden="true" />}
        {it.label}
      </a>
    );

  // Build the visible sequence, collapsing the middle when needed.
  let display = items.map((it, i) => ({ it, i }));
  let collapsed = [];
  if (items.length > maxItems) {
    const tailCount = Math.max(1, maxItems - 2);
    const tail = items.slice(items.length - tailCount).map((it, k) => ({ it, i: items.length - tailCount + k }));
    collapsed = items.slice(1, items.length - tailCount);
    display = [{ it: items[0], i: 0 }, { ellipsis: true }, ...tail];
  }

  return (
    <nav className={["ds-breadcrumb", className].filter(Boolean).join(" ")} aria-label="Breadcrumb">
      <ol className="ds-breadcrumb__list">
        {display.map((d, idx) => {
          const isLastVisual = idx === display.length - 1;
          if (d.ellipsis) {
            return (
              <li key="ellipsis" className="ds-breadcrumb__item">
                <Menu
                  align="start"
                  trigger={<button type="button" className="ds-breadcrumb__more" aria-label="Show hidden path"><Icon name="more-horizontal" size={14} /></button>}
                  items={collapsed.map((c) => ({ label: c.label, icon: c.icon, onClick: c.onClick }))}
                />
                <Icon className="ds-breadcrumb__sep" name="chevron-right" size={14} aria-hidden="true" />
              </li>
            );
          }
          const last = d.i === items.length - 1;
          return (
            <li key={d.i} className="ds-breadcrumb__item">
              {renderCrumb(d.it, last)}
              {!isLastVisual && <Icon className="ds-breadcrumb__sep" name="chevron-right" size={14} aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
