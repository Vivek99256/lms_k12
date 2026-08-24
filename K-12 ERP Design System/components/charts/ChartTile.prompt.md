**ChartTile** — dashboard/analytics building block wrapping a chart.

```jsx
<ChartTile title="Fee collection" subtitle="Last 6 months"
  actions={<SegmentedControl options={ranges} />}
  legend={<ChartLegend items={legendItems} />}>
  <Chart type="area" categories={months} series={series} />
</ChartTile>
```
