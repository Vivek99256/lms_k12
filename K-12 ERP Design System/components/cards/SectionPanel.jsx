import React from "react";
import { Icon } from "../utilities/Icon.jsx";

/**
 * SectionPanel — titles and bounds a discrete section of a page. Optional
 * `collapsible` behavior with an expand/collapse control. Actions slot for
 * section-level controls.
 */
export function SectionPanel({
  title,
  description,
  actions,
  collapsible = false,
  defaultOpen = true,
  children,
  className = "",
  ...rest
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const cls = ["ds-section", className].filter(Boolean).join(" ");
  return (
    <section className={cls} {...rest}>
      <div className="ds-section__header">
        {collapsible ? (
          <button type="button" className="ds-section__toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            <Icon name={open ? "chevron-down" : "chevron-right"} size={18} />
            <span className="ds-section__titles">
              <h3 className="ds-section__title">{title}</h3>
              {description && <p className="ds-section__desc">{description}</p>}
            </span>
          </button>
        ) : (
          <div className="ds-section__titles">
            <h3 className="ds-section__title">{title}</h3>
            {description && <p className="ds-section__desc">{description}</p>}
          </div>
        )}
        {actions && <div className="ds-section__actions">{actions}</div>}
      </div>
      {open && <div className="ds-section__body">{children}</div>}
    </section>
  );
}
