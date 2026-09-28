'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { OverlayWrapper } from '@/components/document-template/editor/settings/OverlayWrapper';
import { PositionControl } from '@/components/document-template/editor/settings/PositionControl';
import { ColorPicker } from '@/components/document-template/editor/settings/ColorPicker';

const fieldClass =
  'h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20';

export type ContainerVisualProps = {
  children?: React.ReactNode;
  direction?: 'column' | 'row';
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  padding?: number;
  gap?: number;
  isOverlay?: boolean;
  x?: number;
  y?: number;
  width?: number | string;
  height?: number | string;
  zIndex?: number;
  emptyHint?: string;
};

/** Shared render for Container and Card -- same layout mechanics, different defaults/label. */
export function ContainerVisual({
  children,
  direction = 'column',
  backgroundColor,
  borderColor,
  borderWidth = 0,
  borderRadius = 0,
  padding = 12,
  gap = 8,
  isOverlay,
  x,
  y,
  width,
  height,
  zIndex,
  emptyHint = 'Empty',
}: ContainerVisualProps) {
  const {
    connectors: { connect },
  } = useNode();

  return (
    <OverlayWrapper isOverlay={isOverlay} x={x} y={y} width={width} height={height} zIndex={zIndex}>
      <div
        ref={(ref) => {
          if (ref) connect(ref);
        }}
        className="relative flex h-full w-full"
        style={{
          flexDirection: direction === 'row' ? 'row' : 'column',
          backgroundColor,
          borderColor,
          borderWidth: borderWidth || undefined,
          borderStyle: borderWidth ? 'solid' : undefined,
          borderRadius,
          padding,
          gap,
        }}
      >
        {children ?? <span className="text-[10px] text-slate-300">{emptyHint}</span>}
      </div>
    </OverlayWrapper>
  );
}

export function ContainerSettingsBody({ tab }: { tab: 'content' | 'design' }) {
  const {
    actions: { setProp },
    props,
  } = useNode((node) => ({ props: node.data.props }));

  if (tab === 'content') {
    return (
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-slate-500">Layout</label>
        <select
          value={props.direction || 'column'}
          onChange={(event) => setProp((p: Record<string, unknown>) => (p.direction = event.target.value))}
          className={fieldClass}
        >
          <option value="column">Stack vertically (column)</option>
          <option value="row">Stack horizontally (row)</option>
        </select>
        <p className="mt-1 text-[10px] text-slate-400">Drag components from the toolbox onto this container to nest them inside it.</p>
      </div>
    );
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
      <ColorPicker
        label="Background color"
        color={props.backgroundColor}
        onChange={(color) => setProp((p: Record<string, unknown>) => (p.backgroundColor = color))}
      />
      <ColorPicker
        label="Border color"
        color={props.borderColor}
        onChange={(color) => setProp((p: Record<string, unknown>) => (p.borderColor = color))}
      />
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-slate-500">Padding</label>
          <input
            type="number"
            value={props.padding ?? 12}
            onChange={(event) => setProp((p: Record<string, unknown>) => (p.padding = Number(event.target.value)))}
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-slate-500">Gap</label>
          <input
            type="number"
            value={props.gap ?? 8}
            onChange={(event) => setProp((p: Record<string, unknown>) => (p.gap = Number(event.target.value)))}
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-slate-500">Radius</label>
          <input
            type="number"
            value={props.borderRadius ?? 0}
            onChange={(event) => setProp((p: Record<string, unknown>) => (p.borderRadius = Number(event.target.value)))}
            className={fieldClass}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-slate-500">Border width</label>
        <input
          type="number"
          value={props.borderWidth ?? 0}
          onChange={(event) => setProp((p: Record<string, unknown>) => (p.borderWidth = Number(event.target.value)))}
          className={fieldClass}
        />
      </div>
    </div>
  );
}

export const MobileContainerBlock = (props: ContainerVisualProps) => (
  <ContainerVisual {...props} emptyHint="Empty container" />
);

const MobileContainerBlockSettings = ({ tab }: { tab: 'content' | 'design' }) => <ContainerSettingsBody tab={tab} />;

MobileContainerBlock.craft = {
  displayName: 'Container',
  props: {
    direction: 'column',
    backgroundColor: 'transparent',
    borderColor: '#E5E7EB',
    borderWidth: 0,
    borderRadius: 0,
    padding: 12,
    gap: 8,
    isOverlay: true,
    x: 20,
    y: 20,
    width: 335,
    height: 120,
    zIndex: 1,
  },
  rules: {
    canDrag: () => true,
  },
  related: {
    settings: MobileContainerBlockSettings,
  },
};
