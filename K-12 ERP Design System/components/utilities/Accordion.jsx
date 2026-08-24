import React from "react";
import { Icon } from "./Icon.jsx";

/**
 * Accordion — stacked collapsible sections. items: [{ id, title, content }].
 * `multiple` allows more than one open at once.
 */
export function Accordion({ items = [], defaultOpen = [], multiple = false, className = "" }) {
  const [open, setOpen] = React.useState(new Set(defaultOpen));
  const toggle = (id) =>
    setOpen((prev) => {
      const next = new Set(multiple ? prev : []);
      if (prev.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <div className={["ds-accordion", className].filter(Boolean).join(" ")}>
      {items.map((it) => {
        const isOpen = open.has(it.id);
        return (
          <div key={it.id} className="ds-accordion__item">
            <button type="button" className="ds-accordion__header" aria-expanded={isOpen} onClick={() => toggle(it.id)}>
              <span className="ds-accordion__title">{it.title}</span>
              <Icon className="ds-accordion__caret" name={isOpen ? "chevron-up" : "chevron-down"} size={18} />
            </button>
            {isOpen && <div className="ds-accordion__body">{it.content}</div>}
          </div>
        );
      })}
    </div>
  );
}
