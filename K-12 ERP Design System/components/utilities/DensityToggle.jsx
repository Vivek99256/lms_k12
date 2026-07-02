import React from "react";
import { SegmentedControl } from "../selection/SegmentedControl.jsx";

/**
 * DensityToggle — switch table/list density (comfortable/cozy/compact).
 * Thin wrapper over SegmentedControl with the standard density options.
 * Apply the chosen value to a `[data-density]` ancestor.
 */
export function DensityToggle({ value = "cozy", onChange, size = "sm", className = "" }) {
  return (
    <SegmentedControl
      className={className}
      size={size}
      label="Row density"
      value={value}
      onChange={onChange}
      options={[
        { value: "comfortable", icon: "rows-3" },
        { value: "cozy", icon: "rows-2" },
        { value: "compact", icon: "menu" },
      ]}
    />
  );
}
