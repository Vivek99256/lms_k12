**StatusView** — empty / error / success / no-results / no-access / offline region. Canonical state view (use instead of empty-state/error-state/success-state).

```jsx
<StatusView variant="empty" title="No students yet"
  description="Add your first student to get started."
  actions={<Button variant="primary" iconStart="plus">Add student</Button>} />

<StatusView variant="no-results" description="Try adjusting your filters." />
```
