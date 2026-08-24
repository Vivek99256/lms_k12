**PasswordStrengthMeter** — strength feedback for a new password.

```jsx
<TextField label="New password" type="password" value={pw} onChange={e=>setPw(e.target.value)} />
<PasswordStrengthMeter value={pw} />
```
