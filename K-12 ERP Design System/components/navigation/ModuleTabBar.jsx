import React from "react";
import { Icon } from "../utilities/Icon.jsx";
import { IconButton } from "../buttons/IconButton.jsx";

/**
 * ModuleTabBar — horizontal sub-module navigation for the "module → sub-module"
 * IA level. Sits below the top bar when a module is open. The active sub-module
 * is a filled pill (styled directly on the tab so it is always legible); the row
 * scrolls horizontally with overflow chevrons and edge fades when it overflows.
 *
 * items: [{ id, label, icon?, count? }]. Controlled via activeId/onSelect.
 */
export function ModuleTabBar({ module, items = [], activeId, onSelect, className = "" }) {
  const active = activeId ?? (items[0] && items[0].id);
  const scrollRef = React.useRef(null);
  const [edge, setEdge] = React.useState({ start: false, end: false });

  const measure = React.useCallback(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    setEdge({ start: sc.scrollLeft > 2, end: sc.scrollLeft + sc.clientWidth < sc.scrollWidth - 2 });
  }, []);

  React.useLayoutEffect(() => {
    measure();
    const sc = scrollRef.current;
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro && sc) ro.observe(sc);
    window.addEventListener("resize", measure);
    return () => { ro && ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [measure, items]);

  // Keep the active sub-module in view.
  React.useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    const btn = sc.querySelector('[data-sub="' + active + '"]');
    if (!btn) return;
    const left = btn.offsetLeft;
    const right = left + btn.offsetWidth;
    if (left < sc.scrollLeft) sc.scrollTo({ left: left - 16, behavior: "smooth" });
    else if (right > sc.scrollLeft + sc.clientWidth) sc.scrollTo({ left: right - sc.clientWidth + 16, behavior: "smooth" });
  }, [active]);

  const nudge = (dir) => { const sc = scrollRef.current; if (sc) sc.scrollBy({ left: dir * 240, behavior: "smooth" }); };

  const mask = edge.start && edge.end
    ? "linear-gradient(to right, transparent, #000 28px, #000 calc(100% - 28px), transparent)"
    : edge.start ? "linear-gradient(to right, transparent, #000 28px)"
    : edge.end ? "linear-gradient(to right, #000 calc(100% - 28px), transparent)"
    : "none";

  return (
    <div className={["ds-modulebar", className].filter(Boolean).join(" ")}>
      {module && (
        <>
          <span className="ds-modulebar__label">{module}</span>
          <span className="ds-modulebar__divider" aria-hidden="true" />
        </>
      )}
      {edge.start && (
        <IconButton className="ds-modulebar__chev" icon="chevron-left" label="Scroll back" variant="ghost" size="sm" onClick={() => nudge(-1)} />
      )}
      <div className="ds-modulebar__scroll" ref={scrollRef} onScroll={measure} style={{ WebkitMaskImage: mask, maskImage: mask }} role="tablist" aria-label={module ? module + " sub-modules" : "Sub-modules"}>
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            role="tab"
            data-sub={it.id}
            aria-selected={it.id === active}
            className={["ds-modulebar__tab", it.id === active ? "is-active" : ""].filter(Boolean).join(" ")}
            onClick={() => onSelect && onSelect(it.id)}
          >
            {it.icon && <Icon name={it.icon} size={16} />}
            <span>{it.label}</span>
            {it.count != null && <span className="ds-modulebar__count">{it.count}</span>}
          </button>
        ))}
      </div>
      {edge.end && (
        <IconButton className="ds-modulebar__chev" icon="chevron-right" label="Scroll forward" variant="ghost" size="sm" onClick={() => nudge(1)} />
      )}
    </div>
  );
}
