import React from "react";
import { Avatar } from "../data-display/Avatar.jsx";
import { Badge } from "../data-display/Badge.jsx";
import { Button } from "../buttons/Button.jsx";

const STATUS = {
  pending: { variant: "warning", label: "Pending" },
  approved: { variant: "success", label: "Approved" },
  rejected: { variant: "error", label: "Rejected" },
  "changes-requested": { variant: "info", label: "Changes requested" },
};

/**
 * ApprovalCard — summarizes an item awaiting a decision with its actions.
 * meta: [{ term, value }] rendered as compact key/values.
 */
export function ApprovalCard({
  title,
  requester,
  requesterAvatar,
  submittedAt,
  status = "pending",
  meta = [],
  onApprove,
  onReject,
  onReview,
  className = "",
}) {
  const s = STATUS[status] || STATUS.pending;
  return (
    <div className={["ds-approval", className].filter(Boolean).join(" ")}>
      <div className="ds-approval__main">
        <div className="ds-approval__head">
          <div className="ds-approval__who">
            <Avatar name={requester} src={requesterAvatar} size="md" />
            <div>
              <p className="ds-approval__title">{title}</p>
              <p className="ds-approval__sub">{requester}{submittedAt ? ` · ${submittedAt}` : ""}</p>
            </div>
          </div>
          <Badge variant={s.variant} dot>{s.label}</Badge>
        </div>
        {meta.length > 0 && (
          <dl className="ds-approval__meta">
            {meta.map((m, i) => (
              <div key={i}><dt>{m.term}</dt><dd>{m.value}</dd></div>
            ))}
          </dl>
        )}
      </div>
      {status === "pending" && (
        <div className="ds-approval__actions">
          {onReview && <Button variant="tertiary" size="sm" onClick={onReview}>Review</Button>}
          {onReject && <Button variant="secondary" size="sm" iconStart="x" onClick={onReject}>Reject</Button>}
          {onApprove && <Button variant="primary" size="sm" iconStart="check" onClick={onApprove}>Approve</Button>}
        </div>
      )}
    </div>
  );
}
