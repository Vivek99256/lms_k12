**RadioGroup** — single choice from a small mutually-exclusive set.

```jsx
<RadioGroup label="Gender" options={[
  { value: "m", label: "Male" },
  { value: "f", label: "Female" },
  { value: "o", label: "Other" },
]} value={g} onChange={setG} orientation="horizontal" />
```

Variants: `default · card`. Orientation: `vertical · horizontal`.
