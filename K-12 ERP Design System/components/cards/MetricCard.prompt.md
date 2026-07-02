**MetricCard** — one KPI with an optional trend. Canonical metric surface (use instead of stat-card / kpi-card).

```jsx
<MetricCard label="Fees collected" value="₹18.4L" icon="wallet"
  trend={{ direction: "up", value: "+8.2%", label: "vs last month" }} />
```

Variants: `kpi · stat`. Pass `loading` for the skeleton state.
