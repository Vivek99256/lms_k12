**Select** — pick one value from a closed list (status, class, section).

```jsx
<Select label="Class" placeholder="Choose class" options={[
  { value: "9a", label: "Grade 9 - A" },
  { value: "9b", label: "Grade 9 - B" },
]} value={cls} onChange={setCls} />
```

For large or remote option sets, use **Combobox** instead.
