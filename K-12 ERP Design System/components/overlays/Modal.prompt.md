**Modal** — blocking dialog for a focused task.

```jsx
<Modal open={open} onClose={close} title="Add fee concession"
  footer={<><Button variant="secondary" onClick={close}>Cancel</Button>
           <Button variant="primary" onClick={save}>Apply</Button></>}>
  <TextField label="Concession %" type="number" />
</Modal>
```

Sizes: `sm · md · lg`. For destructive confirmations use **ConfirmationDialog**.
