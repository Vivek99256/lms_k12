import * as React from "react";

/** Global app bar (banner landmark): brand, module context, search, actions, account. */
export interface TopbarNavProps {
  brand?: React.ReactNode;
  moduleContext?: React.ReactNode;
  /** Global SearchInput. */
  search?: React.ReactNode;
  /** Trailing icon buttons (notifications, help). */
  actions?: React.ReactNode;
  /** Account menu / avatar. */
  account?: React.ReactNode;
  className?: string;
}
export function TopbarNav(props: TopbarNavProps): JSX.Element;
