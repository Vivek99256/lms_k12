'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { OverlayWrapper } from '@/components/document-template/editor/settings/OverlayWrapper';
import { PositionControl } from '@/components/document-template/editor/settings/PositionControl';
import { ColorPicker } from '@/components/document-template/editor/settings/ColorPicker';
import { DataBindingControl } from '../editor/settings/DataBindingControl';
import type { MobileDataBinding } from '../shared/layoutTypes';

const fieldClass =
  'h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20';

export const MobileTextBlock = ({
  content,
  variant = 'body',
  fontSize = 16,
  fontWeight = 'normal',
  color = '#111827',
  alignment = 'left',
  dataBinding,
  isOverlay,
  x,
  y,
  width,
  height,
  zIndex,
}: {
  content?: string;
  variant?: 'body' | 'h1' | 'h2';
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  color?: string;
  alignment?: 'left' | 'center' | 'right';
  dataBinding?: MobileDataBinding | null;
  isOverlay?: boolean;
  x?: number;
  y?: number;
  width?: number | string;
  height?: number | string;
  zIndex?: number;
}) => {
  const displayText = dataBinding?.field ? `{{${dataBinding.field}}}` : content || 'Text';

  return (
    <OverlayWrapper isOverlay={isOverlay} x={x} y={y} width={width} height={height} zIndex={zIndex} isText>
      <div
        style={{
          fontSize: variant === 'h1' ? Math.max(fontSize, 28) : variant === 'h2' ? Math.max(fontSize, 20) : fontSize,
          fontWeight: variant !== 'body' || fontWeight === 'bold' ? 700 : 400,
          color,
          textAlign: alignment,
        }}
        className="w-full break-words"
      >
        {displayText}
      </div>
    </OverlayWrapper>
  );
};

const MobileTextBlockSettings = ({ tab }: { tab: 'content' | 'design' | 'data' }) => {
  const {
    actions: { setProp },
    props,
  } = useNode((node) => ({ props: node.data.props }));

  if (tab === 'content') {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-slate-500">Text</label>
          <textarea
            value={props.content || ''}
            onChange={(event) => setProp((p: Record<string, unknown>) => (p.content = event.target.value))}
            rows={3}
            className={`${fieldClass} h-auto py-2`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-slate-500">Style</label>
          <select
            value={props.variant || 'body'}
            onChange={(event) => setProp((p: Record<string, unknown>) => (p.variant = event.target.value))}
            className={fieldClass}
          >
            <option value="body">Body text</option>
            <option value="h2">Subheading</option>
            <option value="h1">Heading</option>
          </select>
        </div>
      </div>
    );
  }

  if (tab === 'data') {
    return (
      <DataBindingControl
        dataBinding={props.dataBinding}
        onChange={(value) => setProp((p: Record<string, unknown>) => (p.dataBinding = value))}
      />
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
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-slate-500">Font size</label>
          <input
            type="number"
            value={props.fontSize ?? 16}
            onChange={(event) => setProp((p: Record<string, unknown>) => (p.fontSize = Number(event.target.value)))}
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-slate-500">Weight</label>
          <select
            value={props.fontWeight || 'normal'}
            onChange={(event) => setProp((p: Record<string, unknown>) => (p.fontWeight = event.target.value))}
            className={fieldClass}
          >
            <option value="normal">Normal</option>
            <option value="bold">Bold</option>
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-slate-500">Alignment</label>
        <select
          value={props.alignment || 'left'}
          onChange={(event) => setProp((p: Record<string, unknown>) => (p.alignment = event.target.value))}
          className={fieldClass}
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </div>
      <ColorPicker label="Text color" color={props.color} onChange={(color) => setProp((p: Record<string, unknown>) => (p.color = color))} />
    </div>
  );
};

MobileTextBlock.craft = {
  displayName: 'Text',
  props: {
    content: 'Text',
    variant: 'body',
    fontSize: 16,
    fontWeight: 'normal',
    color: '#111827',
    alignment: 'left',
    dataBinding: null,
    isOverlay: true,
    x: 20,
    y: 20,
    width: 335,
    height: 'auto',
    zIndex: 10,
  },
  related: {
    settings: MobileTextBlockSettings,
  },
};
