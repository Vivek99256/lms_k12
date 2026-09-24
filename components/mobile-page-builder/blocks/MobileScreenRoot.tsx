'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { backgroundStyle } from '../shared/backgroundStyle';
import { MOBILE_CANVAS_HEIGHT, MOBILE_CANVAS_WIDTH, type MobileBackground } from '../shared/layoutTypes';

/**
 * The one node every Custom Mobile Page has as Craft.js's ROOT child -- the
 * phone screen itself. Not one of the 8 components an admin picks from the
 * toolbox (mirrors DocumentContainer in the document-template editor, which
 * is the same kind of always-present structural root). Holds every
 * top-level component as an absolutely-positioned child, the same way
 * A4PageBlock holds a document page's content.
 *
 * Its `background` prop is edited from the Toolbox's Background tab (via
 * `actions.setProp` on this node's id, found through
 * `query.node('ROOT').get().data.nodes[0]` -- see MobileToolbox) rather than
 * through the normal select-a-block-then-use-SettingsPanel flow, since this
 * node is not meant to be "selected" like a content block.
 */
export const MobileScreenRoot = ({
  background,
  children,
}: {
  background?: MobileBackground;
  children?: React.ReactNode;
}) => {
  const {
    connectors: { connect },
  } = useNode();

  return (
    <div
      ref={(ref) => {
        if (ref) connect(ref);
      }}
      // overflow-y-auto, not -hidden: a component placed below y=812 (a long
      // imported form easily runs past one screen) must stay reachable by
      // scrolling the SCREEN itself, the same way a real phone would -- not
      // clipped. Position:absolute children don't grow this box (they're out
      // of flow), so without this they'd just be clipped past minHeight.
      // The phone-frame "bezel" around this (MobileEditorCanvas)
      // stays fixed-size; only the screen content inside it scrolls.
      className="relative overflow-y-auto"
      style={{
        width: MOBILE_CANVAS_WIDTH,
        minHeight: MOBILE_CANVAS_HEIGHT,
        maxHeight: MOBILE_CANVAS_HEIGHT,
        ...backgroundStyle(background),
      }}
    >
      {children}
    </div>
  );
};

MobileScreenRoot.craft = {
  displayName: 'Mobile Screen',
  props: {
    background: { type: 'color', color: '#FFFFFF', opacity: 1 } as MobileBackground,
  },
  rules: {
    canDrag: () => false,
    canDelete: () => false,
  },
};
