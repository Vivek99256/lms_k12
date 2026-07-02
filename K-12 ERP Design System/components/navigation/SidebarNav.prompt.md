**SidebarNav** — primary module rail. Items are links or `{ section }` dividers.

```jsx
<SidebarNav activeId="students" onSelect={go}
  header={<Brand />}
  items={[
    { id: "dashboard", label: "Dashboard", icon: "layout-dashboard" },
    { section: "Academics" },
    { id: "students", label: "Students", icon: "users", badge: 128 },
    { id: "fees", label: "Fees", icon: "wallet" },
  ]} />
```

Pass `collapsed` for the icon-only rail.
