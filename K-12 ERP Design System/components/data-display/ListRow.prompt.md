**ListRow** — a row for any non-tabular collection; slot-based (leading / title / subtitle / meta / trailing).

```jsx
<ListRow
  leading={<Avatar name="Aarav Sharma" />}
  title="Aarav Sharma"
  subtitle="Grade 9 - A · Roll 21"
  meta={<Badge variant="success" dot>Active</Badge>}
  trailing={<IconButton icon="chevron-right" label="Open" variant="ghost" />}
  onClick={open}
/>
```
