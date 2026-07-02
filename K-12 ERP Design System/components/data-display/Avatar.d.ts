import * as React from "react";

/** Represents a person/entity: image → initials → icon fallback, with optional presence status. */
export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  name?: string;
  src?: string;
  /** Lucide icon fallback when there's no image or name. */
  icon?: string;
  size?: "sm" | "md" | "lg" | "xl";
  shape?: "circle" | "square";
  status?: "online" | "away" | "offline";
}
export function Avatar(props: AvatarProps): JSX.Element;

/** Overlapping stack of avatars with a +N overflow chip. */
export interface AvatarGroupProps {
  children?: React.ReactNode;
  max?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}
export function AvatarGroup(props: AvatarGroupProps): JSX.Element;
