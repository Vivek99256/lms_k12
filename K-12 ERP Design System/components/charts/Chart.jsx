import React from "react";

const PALETTE = [
  "var(--color-brand-600)",
  "var(--color-success-500)",
  "var(--color-warning-500)",
  "var(--color-info-500)",
  "var(--color-brand-300)",
  "var(--color-error-500)",
];

function niceMax(v) {
  if (v <= 0) return 10;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / mag) * mag;
}

/**
 * Chart — lightweight SVG chart for bar/column, line, area, and donut. Provide
 * `categories` (x labels) + `series` [{ name, values:number[] }] for
 * cartesian types, or `data` [{ label, value }] for donut/pie. Pair with an
 * accessible data table for real usage.
 */
export function Chart({
  type = "bar",
  categories = [],
  series = [],
  data = [],
  height = 240,
  colors = PALETTE,
  showGrid = true,
  className = "",
}) {
  if (type === "donut" || type === "pie") {
    return <DonutChart data={data} colors={colors} height={height} donut={type === "donut"} className={className} />;
  }

  const W = 560, H = height, padL = 40, padB = 28, padT = 12, padR = 8;
  const plotW = W - padL - padR, plotH = H - padB - padT;
  const allVals = series.flatMap((s) => s.values);
  const max = niceMax(Math.max(1, ...allVals));
  const n = categories.length;
  const bandW = plotW / (n || 1);
  const y = (v) => padT + plotH - (v / max) * plotH;
  const gridLines = 4;

  return (
    <div className={["ds-chart", className].filter(Boolean).join(" ")}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" preserveAspectRatio="xMidYMid meet">
        {showGrid && Array.from({ length: gridLines + 1 }).map((_, i) => {
          const gv = (max / gridLines) * i;
          const gy = y(gv);
          return (
            <g key={i}>
              <line x1={padL} y1={gy} x2={W - padR} y2={gy} stroke="var(--border-subtle)" strokeWidth="1" />
              <text x={padL - 6} y={gy + 3} textAnchor="end" fontSize="10" fill="var(--content-tertiary)">{Math.round(gv)}</text>
            </g>
          );
        })}
        {categories.map((c, i) => (
          <text key={i} x={padL + bandW * i + bandW / 2} y={H - 10} textAnchor="middle" fontSize="10" fill="var(--content-secondary)">{c}</text>
        ))}

        {(type === "bar" || type === "column") && series.map((s, si) => {
          const groupW = bandW * 0.62;
          const barW = groupW / series.length;
          return s.values.map((v, i) => (
            <rect
              key={`${si}-${i}`}
              x={padL + bandW * i + (bandW - groupW) / 2 + barW * si}
              y={y(v)}
              width={barW - 1}
              height={padT + plotH - y(v)}
              rx="2"
              fill={colors[si % colors.length]}
            />
          ));
        })}

        {(type === "line" || type === "area") && series.map((s, si) => {
          const pts = s.values.map((v, i) => `${padL + bandW * i + bandW / 2},${y(v)}`).join(" ");
          const color = colors[si % colors.length];
          return (
            <g key={si}>
              {type === "area" && (
                <polygon
                  points={`${padL + bandW / 2},${padT + plotH} ${pts} ${padL + bandW * (s.values.length - 1) + bandW / 2},${padT + plotH}`}
                  fill={color}
                  opacity="0.12"
                />
              )}
              <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              {s.values.map((v, i) => (
                <circle key={i} cx={padL + bandW * i + bandW / 2} cy={y(v)} r="3" fill="var(--surface-default)" stroke={color} strokeWidth="2" />
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function DonutChart({ data, colors, height, donut, className }) {
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  const size = Math.min(height, 220);
  const cx = size / 2, cy = size / 2, r = size / 2 - 6, inner = donut ? r * 0.6 : 0;
  let angle = -Math.PI / 2;
  const arcs = data.map((d, i) => {
    const frac = d.value / total;
    const a0 = angle;
    const a1 = angle + frac * Math.PI * 2;
    angle = a1;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (a, rad) => `${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`;
    const path = donut
      ? `M ${p(a0, r)} A ${r} ${r} 0 ${large} 1 ${p(a1, r)} L ${p(a1, inner)} A ${inner} ${inner} 0 ${large} 0 ${p(a0, inner)} Z`
      : `M ${cx},${cy} L ${p(a0, r)} A ${r} ${r} 0 ${large} 1 ${p(a1, r)} Z`;
    return { path, color: colors[i % colors.length] };
  });
  return (
    <div className={["ds-chart ds-chart--donut", className].filter(Boolean).join(" ")}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img">
        {arcs.map((a, i) => <path key={i} d={a.path} fill={a.color} />)}
        {donut && <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize="20" fontWeight="700" fill="var(--content-primary)">{total}</text>}
      </svg>
    </div>
  );
}
