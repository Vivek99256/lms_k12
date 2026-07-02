import React from "react";
import { Icon } from "../utilities/Icon.jsx";
import { Badge } from "../data-display/Badge.jsx";

const ACTION_VARIANT = { create: "success", update: "info", delete: "error", login: "neutral", export: "brand" };

/**
 * AuditEntry — one immutable audit record (actor, action, target, timestamp).
 * Read-only; renders as an expandable row with optional detail.
 */
export function AuditEntry({ actor, action, actionType = "update", target, timestamp, ip, detail, expandable = false, className = "" }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className={["ds-audit", className].filter(Boolean).join(" ")}>
      <div className="ds-audit__row" role={expandable ? "button" : undefined} onClick={expandable ? () => setOpen((o) => !o) : undefined}>
        {expandable && <Icon className="ds-audit__caret" name={open ? "chevron-down" : "chevron-right"} size={15} />}
        <span className="ds-audit__actor">{actor}</span>
        <Badge variant={ACTION_VARIANT[actionType] || "neutral"} size="sm">{action}</Badge>
        {target && <span className="ds-audit__target">{target}</span>}
        <span className="ds-audit__time">{timestamp}</span>
      </div>
      {expandable && open && (
        <dl className="ds-audit__detail">
          {ip && <div><dt>IP address</dt><dd>{ip}</dd></div>}
          {detail && Object.entries(detail).map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
        </dl>
      )}
    </div>
  );
}
