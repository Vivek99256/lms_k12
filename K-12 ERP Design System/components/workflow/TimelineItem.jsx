import React from "react";
import { Icon } from "../utilities/Icon.jsx";

const TONE_ICON = { default: "circle", success: "check", warning: "alert-triangle", error: "x", info: "info" };

/**
 * TimelineItem — a single dated event in a chronological stream. Render several
 * inside a container; the rail marker + connector are drawn automatically.
 */
export function TimelineItem({ title, timestamp, actor, tone = "default", icon, children, last = false, className = "" }) {
  return (
    <li className={["ds-timeline-item", `is-${tone}`, last ? "is-last" : "", className].filter(Boolean).join(" ")}>
      <span className="ds-timeline-item__marker">
        <Icon name={icon || TONE_ICON[tone]} size={12} stroke={2.25} />
      </span>
      <div className="ds-timeline-item__content">
        <div className="ds-timeline-item__head">
          <span className="ds-timeline-item__title">{title}</span>
          {timestamp && <span className="ds-timeline-item__time">{timestamp}</span>}
        </div>
        {actor && <span className="ds-timeline-item__actor">{actor}</span>}
        {children && <div className="ds-timeline-item__body">{children}</div>}
      </div>
    </li>
  );
}
