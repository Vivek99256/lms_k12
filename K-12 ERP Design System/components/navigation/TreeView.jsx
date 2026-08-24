import React from "react";
import { Icon } from "../utilities/Icon.jsx";

function TreeNode({ node, level, activeId, onSelect, expanded, toggle }) {
  const hasChildren = node.children && node.children.length > 0;
  const isOpen = expanded.has(node.id);
  const active = node.id === activeId;
  return (
    <li className="ds-tree__node" role="none">
      <div
        className={["ds-tree__row", active ? "is-active" : ""].filter(Boolean).join(" ")}
        role="treeitem"
        aria-expanded={hasChildren ? isOpen : undefined}
        aria-selected={active}
        style={{ paddingInlineStart: `calc(${level} * 16px + 8px)` }}
        onClick={() => { if (hasChildren) toggle(node.id); onSelect && onSelect(node.id); }}
      >
        {hasChildren ? (
          <Icon className="ds-tree__caret" name={isOpen ? "chevron-down" : "chevron-right"} size={15} />
        ) : (
          <span className="ds-tree__caret-spacer" />
        )}
        {node.icon && <Icon className="ds-tree__icon" name={node.icon} size={16} />}
        <span className="ds-tree__label">{node.label}</span>
        {node.badge != null && <span className="ds-tree__badge">{node.badge}</span>}
      </div>
      {hasChildren && isOpen && (
        <ul className="ds-tree__children" role="group">
          {node.children.map((c) => (
            <TreeNode key={c.id} node={c} level={level + 1} activeId={activeId} onSelect={onSelect} expanded={expanded} toggle={toggle} />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * TreeView — navigate hierarchical structures (categories, org, settings nav).
 * nodes: [{ id, label, icon?, badge?, children? }]. This is the canonical
 * navigation tree — use for settings-nav rather than a bespoke component.
 */
export function TreeView({ nodes = [], activeId, onSelect, defaultExpanded = [], className = "" }) {
  const [expanded, setExpanded] = React.useState(new Set(defaultExpanded));
  const toggle = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  return (
    <ul className={["ds-tree", className].filter(Boolean).join(" ")} role="tree">
      {nodes.map((n) => (
        <TreeNode key={n.id} node={n} level={0} activeId={activeId} onSelect={onSelect} expanded={expanded} toggle={toggle} />
      ))}
    </ul>
  );
}
