**Icon** — renders a [Lucide](https://lucide.dev) line icon by name. Requires the Lucide UMD global on the page (cards/kits load it from CDN).

```jsx
<Icon name="calendar" size={20} />
<Icon name="alert-triangle" size={16} stroke={2} label="Warning" />
```

Names accept kebab-case (`chevron-down`) or PascalCase (`ChevronDown`). Decorative by default; pass `label` for a meaningful icon.
