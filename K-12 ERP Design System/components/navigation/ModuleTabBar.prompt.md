**ModuleTabBar** — horizontal sub-module navigation (the "module → sub-module" IA level). Place directly below the top bar when a module is open; the sidebar picks the module, this bar picks the sub-module.

```jsx
<ModuleTabBar
  module="Fees"
  activeId={sub}
  onSelect={setSub}
  items={[
    { id: "collect", label: "Fee collection", count: 13 },
    { id: "refund", label: "Cancel / refund" },
    { id: "circular", label: "Fee circular" },
    { id: "structure", label: "Fee structure" },
    { id: "concession", label: "Concessions", count: 4 },
  ]}
/>
```

The active pill indicator slides between sub-modules; the row scrolls horizontally with overflow chevrons + edge fades when it overflows. Use `Tabs` (not this) for in-page peer sections within a single sub-module.
