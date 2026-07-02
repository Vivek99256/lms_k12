**CalendarGrid** — month view with events keyed by date.

```jsx
<CalendarGrid month={new Date(2026,6,1)} onSelectDay={open} events={{
  "2026-07-15": [{ title: "PTM — Grade 9", time: "10:00", tone: "info" }],
  "2026-07-20": [{ title: "Annual Day", allDay: true, tone: "brand" }],
}} />
```
