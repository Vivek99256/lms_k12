import * as React from "react";

export interface ActivityEvent {
  id: string;
  actor: string;
  actorAvatar?: string;
  action: React.ReactNode;
  target?: React.ReactNode;
  timestamp: React.ReactNode;
}

/** A scannable stream of recent events for dashboards and record activity. */
export interface ActivityFeedProps {
  items: ActivityEvent[];
  className?: string;
}
export function ActivityFeed(props: ActivityFeedProps): JSX.Element;
