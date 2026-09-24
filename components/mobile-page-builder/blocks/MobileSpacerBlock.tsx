'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { OverlayWrapper } from '@/components/document-template/editor/settings/OverlayWrapper';
import { PositionControl } from '@/components/document-template/editor/settings/PositionControl';

export const MobileSpacerBlock = ({
  isOverlay,
  x,
  y,
  width,
  height,
  zIndex,
}: {
  isOverlay?: boolean;
  x?: number;
  y?: number;
  width?: number | string;
  height?: number | string;
  zIndex?: number;
}) => {
  return (
    <OverlayWrapper isOverlay={isOverlay} x={x} y={y} width={width} height={height} zIndex={zIndex}>
      <div className="flex h-full w-full items-center justify-center rounded border border-dashed border-slate-200 text-[10px] text-slate-300">
        Spacer
      </div>
    </OverlayWrapper>
  );
};

const MobileSpacerBlockSettings = ({ tab }: { tab: 'content' | 'design' }) => {
  const {
    actions: { setProp },
    props,
  } = useNode((node) => ({ props: node.data.props }));

  if (tab === 'content') {
    return <p className="text-xs text-slate-500">An invisible gap. Resize it on the canvas, or set its height on the Design tab.</p>;
  }

  return (
    <PositionControl
      isOverlay={props.isOverlay}
      x={props.x}
      y={props.y}
      zIndex={props.zIndex}
      onChange={(prop, val) => setProp((p: Record<string, unknown>) => (p[prop] = val))}
    />
  );
};

MobileSpacerBlock.craft = {
  displayName: 'Spacer',
  props: {
    isOverlay: true,
    x: 20,
    y: 20,
    width: 335,
    height: 24,
    zIndex: 5,
  },
  related: {
    settings: MobileSpacerBlockSettings,
  },
};
