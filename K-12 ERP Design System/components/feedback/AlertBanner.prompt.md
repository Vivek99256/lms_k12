**AlertBanner** — persistent section-level message.

```jsx
<AlertBanner variant="warning" title="Fee deadline approaching"
  action={<Button size="sm" variant="secondary">Remind</Button>} onDismiss={dismiss}>
  Term-2 fees are due on 15 July for 42 students.
</AlertBanner>
```

Variants: `info · success · warning · error`.
