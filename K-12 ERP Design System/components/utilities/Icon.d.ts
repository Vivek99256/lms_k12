import * as React from "react";

/**
 * Renders a Lucide line icon by name, sized and stroked to the icon tokens.
 * Requires the Lucide UMD global (window.lucide) to be loaded on the page.
 */
export interface IconProps extends React.SVGAttributes<SVGSVGElement> {
  /** Icon name — kebab-case ("chevron-down") or PascalCase ("ChevronDown"). */
  name: string;
  /** Pixel size (maps to icon.size.* tokens: 12/14/16/20/24/32/40). */
  size?: number;
  /** Stroke width in px (icon.stroke.*): 1.5 thin, 1.75 regular, 2 bold. */
  stroke?: number;
  /** Accessible label. Omit for decorative icons (renders aria-hidden). */
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function Icon(props: IconProps): JSX.Element;
