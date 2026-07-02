import React from "react";

/**
 * Popover — contextual content anchored to a trigger. Click toggles; escape
 * and outside-click dismiss. `content` renders in the floating panel.
 */
export function Popover({ trigger, children, placement = "bottom-start", className = "" }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span className="ds-popover" ref={ref}>
      <span className="ds-popover__trigger" onClick={() => setOpen((o) => !o)}>
        {typeof trigger === "function" ? trigger({ open }) : trigger}
      </span>
      {open && (
        <div className={["ds-popover__panel", `ds-popover__panel--${placement}`, className].filter(Boolean).join(" ")} role="dialog">
          {typeof children === "function" ? children({ close: () => setOpen(false) }) : children}
        </div>
      )}
    </span>
  );
}
