import React from "react";
import { Icon } from "../utilities/Icon.jsx";

/**
 * Stepper — progress through a sequential task. steps: [{ label, description? }].
 * `current` is the active index; earlier steps are completed. Orientation:
 * horizontal | vertical.
 */
export function Stepper({ steps = [], current = 0, orientation = "horizontal", className = "" }) {
  return (
    <ol className={["ds-stepper", `ds-stepper--${orientation}`, className].filter(Boolean).join(" ")}>
      {steps.map((s, i) => {
        const state = i < current ? "complete" : i === current ? "current" : "upcoming";
        return (
          <li key={i} className={["ds-stepper__step", `is-${state}`].join(" ")} aria-current={state === "current" ? "step" : undefined}>
            <span className="ds-stepper__marker">
              {state === "complete" ? <Icon name="check" size={14} stroke={2.5} /> : <span>{i + 1}</span>}
            </span>
            <span className="ds-stepper__text">
              <span className="ds-stepper__label">{s.label}</span>
              {s.description && <span className="ds-stepper__desc">{s.description}</span>}
            </span>
            {i < steps.length - 1 && <span className="ds-stepper__line" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
