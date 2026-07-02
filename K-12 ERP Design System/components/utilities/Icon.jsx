import React from "react";

/**
 * Icon — renders a Lucide line icon by name.
 * Relies on the Lucide UMD global (window.lucide) being present, which every
 * design-system card and UI kit loads from CDN. Falls back to an empty, sized
 * box if the icon or library is unavailable so layout never breaks.
 */

function toPascal(name) {
  if (!name) return "";
  // already PascalCase? return as-is
  if (/^[A-Z]/.test(name) && !name.includes("-")) return name;
  return name
    .split(/[-_\s]+/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
}

export function Icon({ name, size = 20, stroke = 1.75, className = "", style = {}, label, ...rest }) {
  const pascal = toPascal(name);
  const lib = typeof window !== "undefined" ? window.lucide : undefined;
  // Lucide UMD exposes icons either under `.icons[Name]` or as top-level `.Name`.
  let raw = lib ? (lib.icons && lib.icons[pascal]) || lib[pascal] : undefined;
  const node = Array.isArray(raw) ? raw : Array.isArray(raw && raw.iconNode) ? raw.iconNode : undefined;

  const svgProps = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: stroke,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: ("ds-icon " + className).trim(),
    style: { display: "inline-block", flexShrink: 0, verticalAlign: "middle", ...style },
    "aria-hidden": label ? undefined : true,
    role: label ? "img" : undefined,
    "aria-label": label,
    ...rest,
  };

  const children = [];
  if (node) {
    // lucide iconNode: array of [tagName, attrs] (may include a children array)
    node.forEach((entry, i) => {
      const tag = entry[0];
      const attrs = entry[1] || {};
      children.push(React.createElement(tag, { key: i, ...attrs }));
    });
  }

  return React.createElement("svg", svgProps, children);
}
