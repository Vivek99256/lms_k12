import * as React from "react";

/** Loading placeholder mirroring the shape of incoming content. */
export interface SkeletonProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "text" | "block" | "avatar" | "card";
  width?: number | string;
  height?: number | string;
  /** For variant="text", render N stacked lines. */
  lines?: number;
}
export function Skeleton(props: SkeletonProps): JSX.Element;
