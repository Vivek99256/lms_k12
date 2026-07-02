**Avatar / AvatarGroup** — represent people or entities; falls back initials → icon.

```jsx
<Avatar name="Aarav Sharma" src={photo} status="online" />
<Avatar name="Priya Nair" />           {/* initials */}
<AvatarGroup max={3}>{teachers.map(t => <Avatar key={t.id} name={t.name} />)}</AvatarGroup>
```

Sizes: `sm · md · lg · xl`.
