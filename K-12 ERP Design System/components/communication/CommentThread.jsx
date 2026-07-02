import React from "react";
import { Avatar } from "../data-display/Avatar.jsx";
import { Textarea } from "../inputs/Textarea.jsx";
import { Button } from "../buttons/Button.jsx";

/**
 * CommentThread — display and add comments/notes on a record.
 * comments: [{ id, author, authorAvatar?, body, timestamp }].
 */
export function CommentThread({ comments = [], onSubmit, placeholder = "Add a comment…", className = "" }) {
  const [text, setText] = React.useState("");
  const submit = () => {
    if (!text.trim()) return;
    onSubmit && onSubmit(text.trim());
    setText("");
  };
  return (
    <div className={["ds-comments", className].filter(Boolean).join(" ")}>
      <ul className="ds-comments__list">
        {comments.map((c) => (
          <li key={c.id} className="ds-comments__item">
            <Avatar name={c.author} src={c.authorAvatar} size="sm" />
            <div className="ds-comments__bubble">
              <div className="ds-comments__head">
                <span className="ds-comments__author">{c.author}</span>
                <span className="ds-comments__time">{c.timestamp}</span>
              </div>
              <p className="ds-comments__text">{c.body}</p>
            </div>
          </li>
        ))}
      </ul>
      {onSubmit && (
        <div className="ds-comments__composer">
          <Textarea rows={2} placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="ds-comments__composer-actions">
            <Button variant="primary" size="sm" iconStart="send" onClick={submit} disabled={!text.trim()}>Comment</Button>
          </div>
        </div>
      )}
    </div>
  );
}
