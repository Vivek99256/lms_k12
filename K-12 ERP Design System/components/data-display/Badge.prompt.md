**Badge** — status, count, or presence indicator. Add `dot` or `icon` so meaning survives without color.

```jsx
<Badge variant="success" dot>Active</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="error" icon="alert-triangle">Overdue</Badge>
<Badge variant="brand" appearance="count">12</Badge>
```

Variants: `neutral · brand · success · warning · error · info`. This is the canonical status indicator — do NOT create a separate `status-badge`.
