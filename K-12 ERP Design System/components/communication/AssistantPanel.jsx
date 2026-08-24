import React from "react";
import { Icon } from "../utilities/Icon.jsx";
import { IconButton } from "../buttons/IconButton.jsx";

/**
 * AssistantPanel — docked AI copilot / agent surface (right dock). Hosts a chat
 * thread, suggestion chips, a typing indicator and a composer. Controlled: pass
 * messages and handle onSend. messages: [{ id?, role:"assistant"|"user", text, time? }].
 * suggestions: string[] | { text, icon? }[].
 */
export function AssistantPanel({
  title = "Assistant",
  status = "Online",
  messages = [],
  suggestions = [],
  typing = false,
  placeholder = "Ask anything…",
  onSend,
  onClose,
  onNewChat,
  className = "",
}) {
  const [draft, setDraft] = React.useState("");
  const threadRef = React.useRef(null);
  const taRef = React.useRef(null);

  React.useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  const submit = () => {
    const v = draft.trim();
    if (!v) return;
    onSend && onSend(v);
    setDraft("");
    if (taRef.current) taRef.current.style.height = "auto";
  };
  const onKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } };
  const grow = (e) => {
    const t = e.target;
    t.style.height = "auto";
    t.style.height = Math.min(t.scrollHeight, 120) + "px";
    setDraft(t.value);
  };

  return (
    <aside className={["ds-assist", className].filter(Boolean).join(" ")} role="complementary" aria-label={title}>
      <header className="ds-assist__head">
        <span className="ds-assist__avatar"><Icon name="sparkles" size={18} /></span>
        <div className="ds-assist__idtext">
          <div className="ds-assist__title">{title}</div>
          <div className="ds-assist__status">{status}</div>
        </div>
        <div className="ds-assist__actions">
          {onNewChat && <IconButton icon="plus" label="New chat" variant="ghost" size="sm" onClick={onNewChat} />}
          {onClose && <IconButton icon="panel-right-close" label="Close assistant" variant="ghost" size="sm" onClick={onClose} />}
        </div>
      </header>

      <div className="ds-assist__thread" ref={threadRef}>
        {messages.map((m, i) => (
          <div key={m.id || i} className={["ds-assist__msg", `ds-assist__msg--${m.role}`].join(" ")}>
            <div className="ds-assist__bubble">{m.text}</div>
            {m.time && <div className="ds-assist__time">{m.time}</div>}
          </div>
        ))}
        {typing && (
          <div className="ds-assist__typing" role="status" aria-label="Assistant is typing"><span /><span /><span /></div>
        )}
        {suggestions.length > 0 && !typing && (
          <div className="ds-assist__suggest">
            {suggestions.map((s, i) => {
              const text = typeof s === "string" ? s : s.text;
              const icon = typeof s === "string" ? null : s.icon;
              return (
                <button key={i} type="button" className="ds-assist__chip" onClick={() => onSend && onSend(text)}>
                  {icon && <Icon name={icon} size={13} />}
                  {text}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="ds-assist__composer">
        <div className="ds-assist__inputwrap">
          <textarea ref={taRef} className="ds-assist__textarea" rows={1} placeholder={placeholder} value={draft} onChange={grow} onKeyDown={onKey} aria-label="Message" />
          <div className="ds-assist__composer-row">
            <div className="ds-assist__composer-tools">
              <IconButton icon="paperclip" label="Attach file" variant="ghost" size="sm" />
              <IconButton icon="mic" label="Voice input" variant="ghost" size="sm" />
            </div>
            <button type="button" className="ds-assist__send" aria-label="Send message" disabled={!draft.trim()} onClick={submit}>
              <Icon name="arrow-up" size={17} stroke={2.25} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
