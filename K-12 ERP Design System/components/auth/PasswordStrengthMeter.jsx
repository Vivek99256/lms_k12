import React from "react";

function score(pw) {
  let s = 0;
  if (!pw) return 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
}
const LABELS = ["Very weak", "Weak", "Fair", "Good", "Strong"];
const CLASSES = ["vweak", "weak", "fair", "good", "strong"];

/** PasswordStrengthMeter — 4-segment strength bar + label for a password. */
export function PasswordStrengthMeter({ value = "", className = "" }) {
  const s = score(value);
  return (
    <div className={["ds-pw-meter", className].filter(Boolean).join(" ")}>
      <div className="ds-pw-meter__bars" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={["ds-pw-meter__bar", i < s ? `is-${CLASSES[s]}` : ""].filter(Boolean).join(" ")} />
        ))}
      </div>
      <span className={["ds-pw-meter__label", `is-${CLASSES[s]}`].join(" ")} role="status">
        {value ? LABELS[s] : "Enter a password"}
      </span>
    </div>
  );
}
