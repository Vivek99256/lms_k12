**ConfirmationDialog** — guard consequential actions (deletes, publishes, fee changes).

```jsx
<ConfirmationDialog open={open} destructive
  title="Delete this student record?"
  confirmLabel="Delete" onConfirm={remove} onCancel={close}>
  This permanently removes Aarav Sharma and cannot be undone.
</ConfirmationDialog>
```
