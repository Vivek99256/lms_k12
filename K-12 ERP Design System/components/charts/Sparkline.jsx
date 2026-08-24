import React from "react";

/**
 * Sparkline — compact inline trend (line or bar), no axes. `data` is a number
 * array. Tone colors the stroke/fill.
 */
export function Sparkline({ data = [], type = "line", tone = "brand", width = 120, height = 32, className = "" }) {
  if (!data.length) return <svg width={width} height={height} className={className} />;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const stroke = { brand: "var(--action-primary)", success: "var(--feedback-success-solid)", error: "var(--feedback-error-solid)" }[tone] || "var(--action-primary)";
  const x = (i) => (i / (data.length - 1 || 1)) * (width - 2) + 1;
  const y = (v) => height - 2 - ((v - min) / range) * (height - 4);

  if (type === "bar") {
    const bw = (width / data.length) * 0.68;
    return (
      <svg width={width} height={height} className={["ds-sparkline", className].filter(Boolean).join(" ")} aria-hidden="true">
        {data.map((v, i) => (
          <rect key={i} x={x(i) - bw / 2} y={y(v)} width={bw} height={height - 2 - y(v)} rx="1" fill={stroke} opacity="0.85" />
        ))}
      </svg>
    );
  }
  const pts = data.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const area = `M ${x(0)},${height} L ${pts.split(" ").join(" L ")} L ${x(data.length - 1)},${height} Z`;
  return (
    <svg width={width} height={height} className={["ds-sparkline", className].filter(Boolean).join(" ")} aria-hidden="true">
      <path d={area} fill={stroke} opacity="0.10" />
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
