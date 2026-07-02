**FilterBar** — hosts search + filter controls and summarizes applied filters as removable chips.

```jsx
<FilterBar
  resultCount="128 results"
  activeFilters={[{ id: "cls", label: "Grade 9" }]}
  onRemoveFilter={remove}
  onClearAll={clearAll}
  trailing={<DensityToggle value={d} onChange={setD} />}
>
  <SearchInput placeholder="Search students…" />
  <Select options={classes} placeholder="Class" size="sm" />
</FilterBar>
```
