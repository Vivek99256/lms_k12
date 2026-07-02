**Toast** — transient confirmation/notice; stack in a `ToastViewport`.

```jsx
<ToastViewport position="bottom-right">
  <Toast variant="success" title="Payment received" onDismiss={dismiss}>
    Receipt FEE-2026-0912 issued.
  </Toast>
</ToastViewport>
```

Variants: `info · success · warning · error`.
