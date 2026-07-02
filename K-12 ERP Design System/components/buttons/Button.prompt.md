**Button** — the atomic action primitive; use for any single triggered action, choosing the variant by hierarchy (exactly one `primary` per view).

```jsx
<Button variant="primary" iconStart="plus">Add student</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="danger" iconStart="trash-2">Delete</Button>
<Button variant="primary" loading>Saving…</Button>
```

Variants: `primary · secondary · tertiary · danger · ghost · link`. Sizes: `sm · md · lg`. Props: `iconStart`, `iconEnd` (Lucide names), `loading`, `disabled`, `fullWidth`.
