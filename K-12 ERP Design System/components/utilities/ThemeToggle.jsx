import React from "react";
import { Icon } from "./Icon.jsx";

const THEMES = [
  { value: "light", icon: "sun", label: "Light" },
  { value: "dark", icon: "moon", label: "Dark" },
  { value: "high-contrast-light", icon: "contrast", label: "High contrast" },
];

/**
 * ThemeToggle — switch theme by setting [data-theme] on <html>. Controlled via
 * `value`/`onChange`; if uncontrolled, it applies the theme itself.
 */
export function ThemeToggle({ value, onChange, className = "" }) {
  const [internal, setInternal] = React.useState(value || "light");
  const current = value !== undefined ? value : internal;

  const apply = (t) => {
    if (value === undefined) {
      setInternal(t);
      if (typeof document !== "undefined") document.documentElement.setAttribute("data-theme", t);
    }
    onChange && onChange(t);
  };

  return (
    <div className={["ds-segmented ds-segmented--sm", className].filter(Boolean).join(" ")} role="radiogroup" aria-label="Theme">
      {THEMES.map((t) => (
        <button
          key={t.value}
          type="button"
          role="radio"
          aria-checked={current === t.value}
          title={t.label}
          className={["ds-segmented__item", current === t.value ? "is-active" : ""].filter(Boolean).join(" ")}
          onClick={() => apply(t.value)}
        >
          <Icon name={t.icon} size={15} />
        </button>
      ))}
    </div>
  );
}
