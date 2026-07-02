**Popover** — contextual panel anchored to a trigger.

```jsx
<Popover trigger={<IconButton icon="filter" label="Filters" />}>
  {({ close }) => (
    <div style={{ padding: 12 }}>
      <Select options={classes} label="Class" />
      <Button variant="primary" size="sm" onClick={close}>Apply</Button>
    </div>
  )}
</Popover>
```
