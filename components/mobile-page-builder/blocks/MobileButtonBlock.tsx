'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { OverlayWrapper } from '@/components/document-template/editor/settings/OverlayWrapper';
import { PositionControl } from '@/components/document-template/editor/settings/PositionControl';
import { ColorPicker } from '@/components/document-template/editor/settings/ColorPicker';
import { ActionControl } from '../editor/settings/ActionControl';
import type { MobileAction } from '../shared/layoutTypes';

const fieldClass =
  'h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20';

export const MobileButtonBlock = ({
  label = 'Button',
  backgroundColor = '#0D6EFD',
  color = '#FFFFFF',
  borderRadius = 10,
  isOverlay,
  x,
  y,
  width,
  height,
  zIndex,
}: {
  label?: string;
  backgroundColor?: string;
  color?: string;
  borderRadius?: number;
  /** Configured on the Action tab (see MobileButtonBlockSettings) -- not read by this editor-preview visual, only by the runtime renderer. */
  action?: MobileAction | null;
  isOverlay?: boolean;
  x?: number;
  y?: number;
  width?: number | string;
  height?: number | string;
  zIndex?: number;
}) => {
  return (
    <OverlayWrapper isOverlay={isOverlay} x={x} y={y} width={width} height={height} zIndex={zIndex}>
      <button
        type="button"
        onClick={(event) => event.preventDefault()}
        style={{ backgroundColor, color, borderRadius }}
        className="flex h-full w-full items-center justify-center text-sm font-semibold"
      >
        {label}
      </button>
    </OverlayWrapper>
  );
};

const MobileButtonBlockSettings = ({ tab }: { tab: 'content' | 'design' | 'action' }) => {
  const {
    actions: { setProp },
    props,
  } = useNode((node) => ({ props: node.data.props }));

  if (tab === 'content') {
    return (
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-slate-500">Label</label>
        <input
          type="text"
          value={props.label || ''}
          onChange={(event) => setProp((p: Record<string, unknown>) => (p.label = event.target.value))}
          className={fieldClass}
        />
      </div>
    );
  }

  if (tab === 'action') {
    return <ActionControl action={props.action} onChange={(value) => setProp((p: Record<string, unknown>) => (p.action = value))} />;
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
      <ColorPicker label="Text color" color={props.color} onChange={(color) => setProp((p: Record<string, unknown>) => (p.color = color))} />
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-slate-500">Corner radius</label>
        <input
          type="number"
          value={props.borderRadius ?? 10}
          onChange={(event) => setProp((p: Record<string, unknown>) => (p.borderRadius = Number(event.target.value)))}
          className={fieldClass}
        />
      </div>
    </div>
  );
};

MobileButtonBlock.craft = {
  displayName: 'Button',
  props: {
    label: 'Button',
    backgroundColor: '#0D6EFD',
    color: '#FFFFFF',
    borderRadius: 10,
    action: { type: 'none' } as MobileAction,
    isOverlay: true,
    x: 20,
    y: 20,
    width: 335,
    height: 50,
    zIndex: 10,
  },
  related: {
    settings: MobileButtonBlockSettings,
  },
};
