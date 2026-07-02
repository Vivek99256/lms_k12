import React from "react";

/**
 * Skeleton — loading placeholder that mirrors incoming content shape.
 * variants: text (line), block, avatar (circle), card (block w/ radius).
 */
export function Skeleton({ variant = "text", width, height, lines = 1, className = "", style = {}, ...rest }) {
  if (variant === "text" && lines > 1) {
    return (
      <span className={["ds-skel-stack", className].filter(Boolean).join(" ")} aria-hidden="true">
        {Array.from({ length: lines }).map((_, i) => (
          <span key={i} className="ds-skel ds-skel--text" style={{ width: i === lines - 1 ? "70%" : "100%" }} />
        ))}
      </span>
    );
  }
  const cls = ["ds-skel", `ds-skel--${variant}`, className].filter(Boolean).join(" ");
  const s = { ...style };
  if (width != null) s.width = typeof width === "number" ? `${width}px` : width;
  if (height != null) s.height = typeof height === "number" ? `${height}px` : height;
  return <span className={cls} style={s} aria-hidden="true" {...rest} />;
}
