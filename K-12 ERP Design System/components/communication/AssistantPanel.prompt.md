**AssistantPanel** — docked AI copilot / agent surface on the right. Hosts a chat thread, suggestion chips, a typing indicator and a composer. Controlled: hold `messages` in state, append on `onSend`.

```jsx
<AssistantPanel
  title="Teach Assistant"
  status="Online"
  messages={messages}
  typing={thinking}
  suggestions={[
    { text: "Summarise fee defaulters", icon: "wallet" },
    { text: "Draft parent notice", icon: "mail" },
  ]}
  onSend={(text) => addMessage({ role: "user", text })}
  onClose={() => setOpen(false)}
  onNewChat={reset}
/>
```

Dock it as a flex sibling of the content column (fixed 360px) so it pushes the page rather than covering data. Pair with `AssistantLauncher` for the collapsed state. Assistant bubbles sit left; user bubbles right in brand indigo. Enter sends; Shift+Enter for a newline.
