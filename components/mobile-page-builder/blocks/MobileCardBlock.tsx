'use client';

import React from 'react';
import { ContainerSettingsBody, ContainerVisual, type ContainerVisualProps } from './MobileContainerBlock';

/** Same mechanics as Container, pre-styled (white surface, rounded, shadow) so it reads as a distinct "card" component in the toolbox. */
export const MobileCardBlock = (props: ContainerVisualProps) => {
  return (
    <div className="h-full w-full [&>div>div]:shadow-[0_1px_3px_rgba(15,23,42,0.08)]">
      <ContainerVisual {...props} emptyHint="Empty card" />
    </div>
  );
};

const MobileCardBlockSettings = ({ tab }: { tab: 'content' | 'design' }) => <ContainerSettingsBody tab={tab} />;

MobileCardBlock.craft = {
  displayName: 'Card',
  props: {
    direction: 'column',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 8,
    isOverlay: true,
    x: 20,
    y: 20,
    width: 335,
    height: 140,
    zIndex: 1,
  },
  rules: {
    canDrag: () => true,
  },
  related: {
    settings: MobileCardBlockSettings,
  },
};
