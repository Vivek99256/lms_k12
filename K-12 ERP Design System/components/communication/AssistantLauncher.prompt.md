**AssistantLauncher** — floating vertical rail that opens the assistant and switches agents when the panel is collapsed. Anchor it to the right edge (fixed/absolute).

```jsx
<AssistantLauncher
  primaryLabel="Ask Teach Assistant"
  onPrimary={() => setOpen(true)}
  activeId={agent}
  onSelect={(id) => { setAgent(id); setOpen(true); }}
  items={[
    { id: "insights", icon: "trending-up", label: "Insights" },
    { id: "recommend", icon: "lightbulb", label: "Recommendations", badge: true },
    { id: "help", icon: "life-buoy", label: "Help" },
  ]}
/>
```

The primary button is the brand-indigo entry point; agent items select a capability. Show it when `AssistantPanel` is closed; hide it (or keep it) when the panel is open.
