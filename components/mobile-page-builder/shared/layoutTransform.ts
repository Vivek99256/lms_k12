import React from 'react';
import { Element } from '@craftjs/core';
import type { NodeId, SerializedNodes } from '@craftjs/core';
import { MobileScreenRoot } from '../blocks/MobileScreenRoot';
import { MobileTextBlock } from '../blocks/MobileTextBlock';
import { MobileImageBlock } from '../blocks/MobileImageBlock';
import { MobileDividerBlock } from '../blocks/MobileDividerBlock';
import { MobileSpacerBlock } from '../blocks/MobileSpacerBlock';
import { MobileInputBlock } from '../blocks/MobileInputBlock';
import { MobileButtonBlock } from '../blocks/MobileButtonBlock';
import { MobileContainerBlock } from '../blocks/MobileContainerBlock';
import { MobileCardBlock } from '../blocks/MobileCardBlock';
import { MobileListBlock } from '../blocks/MobileListBlock';
import {
  CONTAINER_COMPONENT_TYPES,
  type MobileBackground,
  type MobileComponentType,
  type MobilePageComponentNode,
  type MobilePageLayout,
  type MobilePageMeta,
} from './layoutTypes';

/**
 * The single source of truth mapping a persisted `type` string to the Craft
 * component that renders/edits it, and back. Passed to <Editor resolver=...>
 * as-is; MobilePageLayoutValidator.php's own type allowlist must be kept in
 * step with the keys here by hand (see that file's class doc).
 */
export const RESOLVER = {
  MobileScreenRoot,
  MobileTextBlock,
  MobileImageBlock,
  MobileDividerBlock,
  MobileSpacerBlock,
  MobileInputBlock,
  MobileButtonBlock,
  MobileContainerBlock,
  MobileCardBlock,
  MobileListBlock,
};

const TYPE_TO_COMPONENT: Record<MobileComponentType, keyof typeof RESOLVER> = {
  text: 'MobileTextBlock',
  image: 'MobileImageBlock',
  divider: 'MobileDividerBlock',
  spacer: 'MobileSpacerBlock',
  input: 'MobileInputBlock',
  button: 'MobileButtonBlock',
  container: 'MobileContainerBlock',
  card: 'MobileCardBlock',
  list: 'MobileListBlock',
};

const COMPONENT_TO_TYPE: Record<string, MobileComponentType> = Object.fromEntries(
  Object.entries(TYPE_TO_COMPONENT).map(([type, componentName]) => [componentName, type as MobileComponentType])
);

function isContainerType(type: MobileComponentType): boolean {
  return CONTAINER_COMPONENT_TYPES.includes(type);
}

/** The shape of one entry in Craft.js's `getSerializedNodes()` output that this file actually reads. */
type SerializedNodeShape = {
  type?: string | { resolvedName?: string };
  props?: Record<string, unknown>;
  nodes?: NodeId[];
};

/**
 * One top-level (or nested) component from the persisted layout -> a React
 * element Craft.js can turn into a real node via
 * `query.parseReactElement(el).toNodeTree()`. Nested children are built in
 * the SAME element tree (real JSX children), not as separate calls, so one
 * parseReactElement captures a whole subtree at once.
 */
export function componentToElement(node: MobilePageComponentNode): React.ReactElement {
  const Component = RESOLVER[TYPE_TO_COMPONENT[node.type]] as React.ElementType;
  const commonProps = {
    ...node.props,
    x: node.position?.x ?? 0,
    y: node.position?.y ?? 0,
    width: node.size?.width,
    height: node.size?.height,
  };

  if (isContainerType(node.type)) {
    const children = (node.children ?? []).map((child) => componentToElement(child));
    return React.createElement(Element, { key: node.id, canvas: true, is: Component, ...commonProps }, ...children);
  }

  return React.createElement(Component, { key: node.id, ...commonProps });
}

/** All top-level components -> one element per component, ready for repeated `actions.addNodeTree`. */
export function componentsToElements(components: MobilePageComponentNode[]): React.ReactElement[] {
  return components.map((component) => componentToElement(component));
}

/**
 * Walks a Craft.js node id (and its children) back into the persisted
 * schema. `x`/`y`/`width`/`height` are bucketed into `position`/`size`;
 * everything else on the node's props passes through as-is into `props`.
 */
function serializedNodeToComponent(nodeId: NodeId, nodes: SerializedNodes): MobilePageComponentNode | null {
  const node = nodes[nodeId] as SerializedNodeShape | undefined;
  if (!node) return null;

  const resolvedName = typeof node.type === 'string' ? node.type : node.type?.resolvedName;
  const type = COMPONENT_TO_TYPE[resolvedName as string];
  if (!type) return null; // Unknown to this builder -- dropped rather than persisted unsafely.

  const { x = 0, y = 0, width, height, ...rest } = (node.props ?? {}) as Record<string, unknown>;
  const childIds: NodeId[] = node.nodes ?? [];
  const children = isContainerType(type)
    ? childIds.map((id) => serializedNodeToComponent(id, nodes)).filter((c): c is MobilePageComponentNode => c !== null)
    : undefined;

  return {
    id: nodeId,
    type,
    position: { x: Number(x) || 0, y: Number(y) || 0 },
    size: { width: (width as number | string | undefined) ?? 'auto', height: (height as number | string | undefined) ?? 'auto' },
    props: rest,
    ...(children ? { children } : {}),
  };
}

/**
 * The whole editor state -> a persistable layout. `meta` (name/width/height/
 * dataSource) is supplied separately -- see the editor page -- since those
 * live as plain React state outside the Craft tree, not as a node's props.
 * `background` is read directly off node "ROOT" -- whatever component is
 * passed as <Frame>'s single JSX child becomes node id "ROOT" itself (not a
 * wrapper above it; confirmed against how the document-template editor's own
 * EditorCanvas reads DocumentContainer's children straight off
 * query.node('ROOT')), and MobileScreenRoot is always that child here.
 */
export function serializeToLayout(nodes: SerializedNodes, meta: MobilePageMeta): MobilePageLayout {
  const root = nodes.ROOT as SerializedNodeShape | undefined;

  const background = (root?.props?.background as MobileBackground | undefined) ?? meta.background;
  const componentIds: NodeId[] = root?.nodes ?? [];
  const components = componentIds
    .map((id) => serializedNodeToComponent(id, nodes))
    .filter((c): c is MobilePageComponentNode => c !== null);

  return {
    page: { ...meta, background },
    components,
  };
}
