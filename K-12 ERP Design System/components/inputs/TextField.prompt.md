**TextField** — labeled single-line input for every data-entry surface. Pass `errorText` to enter the (icon + text) error state; `type="password"` adds a reveal toggle.

```jsx
<TextField label="Student name" placeholder="Full name" required />
<TextField label="Email" type="email" iconStart="mail" helperText="Parent's primary email" />
<TextField label="Password" type="password" errorText="Must be at least 8 characters" />
```

Sizes: `sm · md · lg`. Props: `helperText`, `errorText`, `required`, `disabled`, `readOnly`, `iconStart`, `iconEnd`.
