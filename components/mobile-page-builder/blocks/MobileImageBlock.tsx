'use client';

import React, { useRef, useState } from 'react';
import { useNode } from '@craftjs/core';
import { ImageIcon, Loader2, UploadCloud } from 'lucide-react';
import { OverlayWrapper } from '@/components/document-template/editor/settings/OverlayWrapper';
import { PositionControl } from '@/components/document-template/editor/settings/PositionControl';
import { DataBindingControl } from '../editor/settings/DataBindingControl';
import { useMobileBuilderContext } from '../editor/MobileBuilderContext';
import type { MobileDataBinding } from '../shared/layoutTypes';

const fieldClass =
  'h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20';

export const MobileImageBlock = ({
  src,
  objectFit = 'cover',
  borderRadius = 0,
  dataBinding,
  isOverlay,
  x,
  y,
  width,
  height,
  zIndex,
}: {
  src?: string;
  objectFit?: 'cover' | 'contain';
  borderRadius?: number;
  dataBinding?: MobileDataBinding | null;
  isOverlay?: boolean;
  x?: number;
  y?: number;
  width?: number | string;
  height?: number | string;
  zIndex?: number;
}) => {
  return (
    <OverlayWrapper isOverlay={isOverlay} x={x} y={y} width={width} height={height} zIndex={zIndex}>
      <div
        className="flex h-full w-full items-center justify-center overflow-hidden bg-slate-100 text-slate-400"
        style={{ borderRadius }}
      >
        {dataBinding?.field ? (
          <div className="flex flex-col items-center gap-1 text-[10px]">
            <ImageIcon className="size-5" />
            {`{{${dataBinding.field}}}`}
          </div>
        ) : src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="h-full w-full" style={{ objectFit }} />
        ) : (
          <ImageIcon className="size-6" />
        )}
      </div>
    </OverlayWrapper>
  );
};

const MobileImageBlockSettings = ({ tab }: { tab: 'content' | 'design' | 'data' }) => {
  const {
    actions: { setProp },
    props,
  } = useNode((node) => ({ props: node.data.props }));
  const { uploadAsset } = useMobileBuilderContext();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setBusy(true);
    setError('');
    try {
      const url = await uploadAsset(file);
      setProp((p: Record<string, unknown>) => (p.src = url));
    } catch (uploadError: unknown) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  };

  if (tab === 'content') {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-slate-500">Image</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleUpload(file);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 py-3 text-xs font-medium text-slate-600 hover:border-blue-300 hover:bg-blue-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
            {busy ? 'Uploading…' : 'Upload image'}
          </button>
          {error ? <p className="text-[11px] text-red-600">{error}</p> : null}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-slate-500">Or paste a URL</label>
          <input
            type="text"
            value={props.src || ''}
            onChange={(event) => setProp((p: Record<string, unknown>) => (p.src = event.target.value))}
            placeholder="https://…"
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-slate-500">Fit</label>
          <select
            value={props.objectFit || 'cover'}
            onChange={(event) => setProp((p: Record<string, unknown>) => (p.objectFit = event.target.value))}
            className={fieldClass}
          >
            <option value="cover">Cover</option>
            <option value="contain">Contain</option>
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
        placeholder="student.profile_image"
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
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-slate-500">Corner radius</label>
        <input
          type="number"
          value={props.borderRadius ?? 0}
          onChange={(event) => setProp((p: Record<string, unknown>) => (p.borderRadius = Number(event.target.value)))}
          className={fieldClass}
        />
      </div>
    </div>
  );
};

MobileImageBlock.craft = {
  displayName: 'Image',
  props: {
    src: '',
    objectFit: 'cover',
    borderRadius: 8,
    dataBinding: null,
    isOverlay: true,
    x: 20,
    y: 20,
    width: 120,
    height: 120,
    zIndex: 10,
  },
  related: {
    settings: MobileImageBlockSettings,
  },
};
