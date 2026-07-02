import React from "react";
import { Avatar } from "../data-display/Avatar.jsx";
import { Icon } from "../utilities/Icon.jsx";
import { IconButton } from "../buttons/IconButton.jsx";

const TYPE_ICON = { fee: "wallet", admission: "user-plus", consent: "file-check", transport: "bus", system: "bell", message: "mail" };

/**
 * NotificationItem — one notification with unread state and actions. Unread is
 * shown by weight + a dot (not color alone).
 */
export function NotificationItem({ title, body, timestamp, type = "system", unread = false, onOpen, onDismiss, className = "" }) {
  return (
    <div
      className={["ds-notif", unread ? "is-unread" : "", onOpen ? "is-interactive" : "", className].filter(Boolean).join(" ")}
      role={onOpen ? "button" : undefined}
      onClick={onOpen}
    >
      <span className="ds-notif__icon"><Icon name={TYPE_ICON[type] || "bell"} size={16} /></span>
      <div className="ds-notif__body">
        <p className="ds-notif__title">{title}</p>
        {body && <p className="ds-notif__text">{body}</p>}
        <span className="ds-notif__time">{timestamp}</span>
      </div>
      {unread && <span className="ds-notif__dot" aria-label="Unread" />}
      {onDismiss && (
        <span className="ds-notif__dismiss" onClick={(e) => e.stopPropagation()}>
          <IconButton icon="x" label="Dismiss" size="sm" variant="ghost" onClick={onDismiss} />
        </span>
      )}
    </div>
  );
}
