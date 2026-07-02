**Chart** — SVG bar/column/line/area/donut chart. Wrap in a **ChartTile** for titles + states.

```jsx
<Chart type="bar" categories={["Apr","May","Jun"]}
  series={[{ name: "Collected", values: [18,22,26] }]} />

<Chart type="donut" data={[
  { label: "Paid", value: 320 }, { label: "Pending", value: 84 },
]} />
```

Pair with a `DataTable` for the accessible data alternative.
