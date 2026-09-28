'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { OverlayWrapper } from '@/components/document-template/editor/settings/OverlayWrapper';
import { PositionControl } from '@/components/document-template/editor/settings/PositionControl';
import { ColorPicker } from '@/components/document-template/editor/settings/ColorPicker';

const fieldClass =
  'h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20';

export const MobileDividerBlock = ({
  color = '#E5E7EB',
  thickness = 1,
  isOverlay,
  x,
  y,
  width,
  height,
  zIndex,
}: {
  color?: string;
  thickness?: number;
  isOverlay?: boolean;
  x?: number;
  y?: number;
  width?: number | string;
  height?: number | string;
  zIndex?: number;
}) => {
  return (
    <OverlayWrapper isOverlay={isOverlay} x={x} y={y} width={width} height={height} zIndex={zIndex} noResize>
      <div className="flex h-full w-full items-center">
        <div style={{ backgroundColor: color, height: thickness, width: '100%' }} />
      </div>
    </OverlayWrapper>
  );
};

const MobileDividerBlockSettings = ({ tab }: { tab: 'content' | 'design' }) => {
  const {
    actions: { setProp },
    props,
  } = useNode((node) => ({ props: node.data.props }));

  if (tab === 'content') {
    return <p className="text-xs text-slate-500">A thin horizontal rule. Use the Design tab to change its color and thickness.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PositionControl
        isOverlay={props.isOverlay}
        x={props.x}
        y={props.y}
        zIndex={props.zIndex}
        onChange={(prop, val) => setProp((p: Record<string, unknown>) => (p[prop] = val))}
      />
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-slate-500">Thickness</label>
        <input
          type="number"
          value={props.thickness ?? 1}
          onChange={(event) => setProp((p: Record<string, unknown>) => (p.thickness = Number(event.target.value)))}
          className={fieldClass}
        />
      </div>
      <ColorPicker label="Color" color={props.color} onChange={(color) => setProp((p: Record<string, unknown>) => (p.color = color))} />
    </div>
  );
};

MobileDividerBlock.craft = {
  displayName: 'Divider',
  props: {
    color: '#E5E7EB',
    thickness: 1,
    isOverlay: true,
    x: 20,
    y: 20,
    width: 335,
    height: 16,
    zIndex: 10,
  },
  related: {
    settings: MobileDividerBlockSettings,
  },
};
