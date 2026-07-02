**TreeView** — hierarchical navigation; canonical settings-nav (don't create a separate `settings-nav`).

```jsx
<TreeView activeId="grading" defaultExpanded={["academics"]} onSelect={go} nodes={[
  { id: "academics", label: "Academics", icon: "book-open", children: [
    { id: "grading", label: "Grading scheme" },
    { id: "terms", label: "Terms & sessions" },
  ]},
]} />
```
