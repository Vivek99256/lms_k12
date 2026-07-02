import * as React from "react";

/** Summarizes an item awaiting authorization with its decision actions. */
export interface ApprovalCardProps {
  title: React.ReactNode;
  requester?: string;
  requesterAvatar?: string;
  submittedAt?: React.ReactNode;
  status?: "pending" | "approved" | "rejected" | "changes-requested";
  meta?: { term: React.ReactNode; value: React.ReactNode }[];
  onApprove?: () => void;
  onReject?: () => void;
  onReview?: () => void;
  className?: string;
}
export function ApprovalCard(props: ApprovalCardProps): JSX.Element;
