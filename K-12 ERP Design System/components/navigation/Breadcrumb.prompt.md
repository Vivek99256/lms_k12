**Breadcrumb** — location trail with a path back. Last item is the current page.

```jsx
<Breadcrumb items={[
  { label: "Home", icon: "house", onClick: goHome },
  { label: "Students", onClick: goStudents },
  { label: "Grade 9 · A", onClick: goClass },
  { label: "Aarav Sharma" },
]} />
```

Past `maxItems` (default 4) the middle collapses into a `…` overflow menu (first + last items stay visible). Segments are hover-chips; give the root an `icon`.
