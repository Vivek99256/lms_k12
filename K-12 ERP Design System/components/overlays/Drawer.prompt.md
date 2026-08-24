**Drawer** — edge-anchored side panel for reviewing/editing in context.

```jsx
<Drawer open={open} onClose={close} title="Review application"
  footer={<Button variant="primary" fullWidth>Approve</Button>}>
  <DescriptionList items={…} />
</Drawer>
```

Edges: `inline-end · inline-start · bottom-sheet`. Sizes: `sm · md · lg`.
