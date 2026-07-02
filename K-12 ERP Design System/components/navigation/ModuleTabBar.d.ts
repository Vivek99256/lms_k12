import * as React from "react";

export interface ModuleTabItem {
  id: string;
  label: React.ReactNode;
  /** Optional leading Lucide icon. */
  icon?: string;
  /** Optional trailing count pill (e.g. pending records). */
  count?: React.ReactNode;
}

/**
 * Horizontal sub-module navigation — the "module → sub-module" IA level. Sits
 * directly below the top bar when a module is open; a filled indicator slides
 * to the active sub-module and the row scrolls with overflow chevrons.
 *
 * @startingPoint section="Navigation" subtitle="Horizontal sub-module bar with sliding indicator" viewport="900x120"
 */
export interface ModuleTabBarProps {
  /** Overline label shown before the tabs (e.g. the module name "FEES"). */
  module?: React.ReactNode;
  items: ModuleTabItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  className?: string;
}
export function ModuleTabBar(props: ModuleTabBarProps): JSX.Element;
