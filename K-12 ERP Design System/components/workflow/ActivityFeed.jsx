import React from "react";
import { Avatar } from "../data-display/Avatar.jsx";

/**
 * ActivityFeed — aggregates recent events into a scannable stream.
 * items: [{ id, actor, actorAvatar?, action, target?, timestamp }].
 */
export function ActivityFeed({ items = [], className = "" }) {
  return (
    <ul className={["ds-activity", className].filter(Boolean).join(" ")}>
      {items.map((it) => (
        <li key={it.id} className="ds-activity__item">
          <Avatar name={it.actor} src={it.actorAvatar} size="sm" />
          <div className="ds-activity__content">
            <p className="ds-activity__text">
              <span className="ds-activity__actor">{it.actor}</span> {it.action}
              {it.target && <> <span className="ds-activity__target">{it.target}</span></>}
            </p>
            <span className="ds-activity__time">{it.timestamp}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
