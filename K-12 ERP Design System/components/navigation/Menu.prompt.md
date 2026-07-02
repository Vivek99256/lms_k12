**Menu** — dropdown of actions anchored to a trigger. Canonical dropdown (use instead of `dropdown-menu`).

```jsx
<Menu align="end" trigger={<IconButton icon="more-vertical" label="More actions" />}
  items={[
    { label: "View", icon: "eye", onClick: view },
    { label: "Edit", icon: "pencil", onClick: edit },
    { divider: true },
    { label: "Delete", icon: "trash-2", danger: true, onClick: remove },
  ]} />
```
