**CommandPalette** — global command / jump-to surface (Cmd/Ctrl-K). The fast path across all 15 modules; pairs with global search. Controlled via `open` / `onClose`.

```jsx
const [open, setOpen] = React.useState(false);
React.useEffect(() => {
  const h = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen(true); } };
  document.addEventListener("keydown", h);
  return () => document.removeEventListener("keydown", h);
}, []);

<CommandPalette open={open} onClose={() => setOpen(false)} groups={[
  { label: "Navigate", items: [
    { id: "students", label: "Students", icon: "users", onSelect: () => go("students") },
    { id: "fees", label: "Fees", icon: "wallet", keywords: "payment invoice", onSelect: () => go("fees") },
  ]},
  { label: "Actions", items: [
    { id: "add", label: "Add student", icon: "user-plus", shortcut: ["A"], onSelect: addStudent },
  ]},
]} />
```

Type to filter (label + keywords); ↑/↓ move, ↵ runs the item's `onSelect`, esc closes.
