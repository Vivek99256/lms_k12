**ButtonGroup / SplitButton** — group related actions, or pair a primary action with a menu of secondary ones.

```jsx
<ButtonGroup variant="attached" label="Text style">
  <IconButton icon="bold" label="Bold" />
  <IconButton icon="italic" label="Italic" />
</ButtonGroup>

<SplitButton onClick={save} items={[
  { label: "Save as draft", icon: "file" },
  { label: "Save & new", icon: "plus" },
]}>Save</SplitButton>
```

Use `SplitButton` for export/save-as style actions. `ButtonGroup` variants: `attached · spaced`.
