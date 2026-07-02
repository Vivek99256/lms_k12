import React from "react";

/**
 * OtpInput — segmented one-time-code entry. `length` boxes; emits the joined
 * value via onChange and onComplete when full. Handles paste and backspace.
 */
export function OtpInput({ length = 6, value = "", onChange, onComplete, disabled = false, className = "" }) {
  const refs = React.useRef([]);
  const chars = value.split("").slice(0, length);
  while (chars.length < length) chars.push("");

  const set = (i, ch) => {
    const next = chars.slice();
    next[i] = ch;
    const joined = next.join("");
    onChange && onChange(joined);
    if (joined.length === length && !joined.includes("")) onComplete && onComplete(joined);
  };

  const onKey = (i, e) => {
    if (e.key === "Backspace" && !chars[i] && i > 0) refs.current[i - 1]?.focus();
  };
  const onInput = (i, e) => {
    const v = e.target.value.replace(/\D/g, "").slice(-1);
    set(i, v);
    if (v && i < length - 1) refs.current[i + 1]?.focus();
  };
  const onPaste = (e) => {
    const digits = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, length);
    if (!digits) return;
    e.preventDefault();
    onChange && onChange(digits);
    if (digits.length === length) onComplete && onComplete(digits);
    refs.current[Math.min(digits.length, length - 1)]?.focus();
  };

  return (
    <div className={["ds-otp", className].filter(Boolean).join(" ")} onPaste={onPaste}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          className="ds-otp__box"
          inputMode="numeric"
          maxLength={1}
          value={chars[i]}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => onInput(i, e)}
          onKeyDown={(e) => onKey(i, e)}
        />
      ))}
    </div>
  );
}
