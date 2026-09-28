'use client';

import React, { useRef, useState } from 'react';
import { useEditor, Element } from '@craftjs/core';
import {
  Braces,
  Heading,
  Image as ImageIcon,
  Layers,
  List as ListIcon,
  Loader2,
  Minus,
  MousePointerClick,
  Palette,
  Settings,
  Space,
  Square,
  TextCursorInput,
  Type,
  UploadCloud,
  X,
} from 'lucide-react';
import { MobileTextBlock } from '../blocks/MobileTextBlock';
import { MobileImageBlock } from '../blocks/MobileImageBlock';
import { MobileDividerBlock } from '../blocks/MobileDividerBlock';
import { MobileSpacerBlock } from '../blocks/MobileSpacerBlock';
import { MobileInputBlock } from '../blocks/MobileInputBlock';
import { MobileButtonBlock } from '../blocks/MobileButtonBlock';
import { MobileContainerBlock } from '../blocks/MobileContainerBlock';
import { MobileCardBlock } from '../blocks/MobileCardBlock';
import { MobileListBlock } from '../blocks/MobileListBlock';
import { MobileSettingsPanel } from './MobileSettingsPanel';
import { MobileLayersPanel } from './MobileLayersPanel';
import { useMobileBuilderContext } from './MobileBuilderContext';
import type { MobileBackground } from '../shared/layoutTypes';

type TabKey = 'add' | 'background' | 'settings' | 'layers';

function RailItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className={`group relative flex w-16 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl py-2.5 text-[10px] font-semibold transition-all ${
        active ? 'bg-blue-50/80 text-[#0D6EFD]' : 'text-gray-500 hover:bg-gray-50/80 hover:text-gray-900'
      }`}
    >
      {active && <span className="absolute top-1/2 left-0 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[#0D6EFD]" />}
      <Icon size={20} strokeWidth={active ? 2.5 : 2} />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

const ADD_ITEMS: Array<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  build: (x: number, y: number) => React.ReactElement;
}> = [
  { icon: Type, label: 'Text', build: (x, y) => <MobileTextBlock content="Text" x={x} y={y} width={200} height="auto" /> },
  { icon: Heading, label: 'Heading', build: (x, y) => <MobileTextBlock content="Heading" variant="h1" fontSize={28} x={x} y={y} width={280} height="auto" /> },
  { icon: ImageIcon, label: 'Image', build: (x, y) => <MobileImageBlock x={x} y={y} width={120} height={120} /> },
  { icon: TextCursorInput, label: 'Input', build: (x, y) => <MobileInputBlock label="Label" x={x} y={y} width={280} height={50} /> },
  { icon: MousePointerClick, label: 'Button', build: (x, y) => <MobileButtonBlock label="Button" x={x} y={y} width={280} height={48} /> },
  { icon: Minus, label: 'Divider', build: (x, y) => <MobileDividerBlock x={x} y={y} width={280} height={16} /> },
  { icon: Space, label: 'Spacer', build: (x, y) => <MobileSpacerBlock x={x} y={y} width={280} height={24} /> },
  { icon: ListIcon, label: 'List', build: (x, y) => <MobileListBlock listTitle="List" x={x} y={y} width={335} height={300} /> },
];

export const MobileToolbox = ({ activeTab, setActiveTab }: { activeTab: TabKey | null; setActiveTab: (tab: TabKey | null) => void }) => {
  const { actions, query } = useEditor();
  const insertCountRef = useRef(0);

  const getParentId = (): string => {
    const selected = query.getEvent('selected').first();
    // A plain lookup on query.getNodes(), not query.node(id).get() -- the
    // latter throws Craft.js's "Node does not exist" invariant if `selected`
    // ever lags one tick behind a just-deleted node (see MobileEditorCanvas's
    // doc comment for how that happened once already).
    const node = selected ? query.getNodes()[selected] : undefined;
    if (node?.data?.isCanvas) return selected as string;
    return 'ROOT';
  };

  const nextPoint = () => {
    const step = insertCountRef.current % 10;
    insertCountRef.current += 1;
    return { x: 20 + step * 12, y: 24 + step * 36 };
  };

  const addLeaf = (build: (x: number, y: number) => React.ReactElement) => {
    const { x, y } = nextPoint();
    const tree = query.parseReactElement(build(x, y)).toNodeTree();
    actions.addNodeTree(tree, getParentId());
  };

  const addContainer = (Component: typeof MobileContainerBlock, width: number, height: number) => {
    const { x, y } = nextPoint();
    const tree = query
      .parseReactElement(<Element canvas is={Component} x={x} y={y} width={width} height={height} />)
      .toNodeTree();
    actions.addNodeTree(tree, getParentId());
  };

  const toggleTab = (tab: TabKey) => setActiveTab(activeTab === tab ? null : tab);

  return (
    <div className="relative flex h-full">
      <div className="relative z-20 flex h-full w-20 shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-gray-100 bg-white py-4">
        <RailItem icon={Square} label="Add" active={activeTab === 'add'} onClick={() => toggleTab('add')} />
        <RailItem icon={Palette} label="Background" active={activeTab === 'background'} onClick={() => toggleTab('background')} />
        <RailItem icon={Settings} label="Settings" active={activeTab === 'settings'} onClick={() => toggleTab('settings')} />
        <RailItem icon={Layers} label="Layers" active={activeTab === 'layers'} onClick={() => toggleTab('layers')} />
      </div>

      <div
        className={`absolute top-0 left-20 z-10 flex h-full flex-col border-r border-gray-100 bg-white shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-transform duration-300 ${
          activeTab ? 'translate-x-0' : '-translate-x-full'
        } ${activeTab === 'settings' ? 'w-80' : 'w-72'}`}
      >
        {activeTab !== 'settings' && (
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h3 className="text-sm font-semibold capitalize text-gray-900">{activeTab || ''}</h3>
            <button type="button" onClick={() => setActiveTab(null)} className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-[#0D6EFD]">
              <X className="size-4" />
            </button>
          </div>
        )}

        {activeTab === 'settings' && <MobileSettingsPanel onClose={() => setActiveTab(null)} />}
        {activeTab === 'layers' && <MobileLayersPanel />}

        {activeTab === 'add' && (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-4 grid grid-cols-2 gap-2">
              {ADD_ITEMS.map(({ icon: Icon, label, build }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => addLeaf(build)}
                  className="flex flex-col items-center gap-2 rounded-xl border border-blue-100/50 bg-white/80 p-3 text-xs font-medium text-slate-700 shadow-sm transition-all hover:border-blue-300 hover:bg-blue-50"
                >
                  <Icon className="size-5 text-[#0D6EFD]" />
                  {label}
                </button>
              ))}
            </div>

            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#0D6EFD]">Layout</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => addContainer(MobileContainerBlock, 335, 120)}
                className="flex flex-col items-center gap-2 rounded-xl border border-blue-100/50 bg-white/80 p-3 text-xs font-medium text-slate-700 shadow-sm hover:border-blue-300 hover:bg-blue-50"
              >
                <Square className="size-5 text-[#0D6EFD]" />
                Container
              </button>
              <button
                type="button"
                onClick={() => addContainer(MobileCardBlock, 335, 140)}
                className="flex flex-col items-center gap-2 rounded-xl border border-blue-100/50 bg-white/80 p-3 text-xs font-medium text-slate-700 shadow-sm hover:border-blue-300 hover:bg-blue-50"
              >
                <Braces className="size-5 text-[#0D6EFD]" />
                Card
              </button>
            </div>
          </div>
        )}

        {activeTab === 'background' && <BackgroundTab />}
      </div>
    </div>
  );
};

function BackgroundTab() {
  const { query, actions } = useEditor();
  const { uploadAsset } = useMobileBuilderContext();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const background: MobileBackground = query.getNodes().ROOT?.data?.props?.background ?? { type: 'color', color: '#FFFFFF', opacity: 1 };

  const update = (patch: Partial<MobileBackground>) => {
    actions.setProp('ROOT', (props: Record<string, unknown>) => {
      props.background = { ...background, ...patch };
    });
  };

  const handleUpload = async (file: File) => {
    setBusy(true);
    setError('');
    try {
      const url = await uploadAsset(file);
      update({ url });
    } catch (uploadError: unknown) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="mb-4 flex flex-col gap-1">
        <label className="text-[11px] font-medium text-slate-500">Type</label>
        <select
          value={background.type}
          onChange={(event) => update({ type: event.target.value as MobileBackground['type'] })}
          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs shadow-sm outline-none focus:border-blue-400"
        >
          <option value="color">Solid Color</option>
          <option value="image">Image</option>
          <option value="gradient">Gradient</option>
        </select>
      </div>

      {background.type === 'color' && (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-slate-500">Color</label>
          <input type="color" value={background.color || '#FFFFFF'} onChange={(event) => update({ color: event.target.value })} className="h-10 w-full rounded-lg border border-slate-200" />
        </div>
      )}

      {background.type === 'gradient' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-slate-500">From</label>
            <input type="color" value={background.gradientFrom || '#FFFFFF'} onChange={(event) => update({ gradientFrom: event.target.value })} className="h-10 w-full rounded-lg border border-slate-200" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-slate-500">To</label>
            <input type="color" value={background.gradientTo || '#F1F5F9'} onChange={(event) => update({ gradientTo: event.target.value })} className="h-10 w-full rounded-lg border border-slate-200" />
          </div>
        </div>
      )}

      {background.type === 'image' && (
        <div className="flex flex-col gap-4">
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

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-slate-500">Size</label>
              <select value={background.size || 'cover'} onChange={(event) => update({ size: event.target.value as MobileBackground['size'] })} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs">
                <option value="cover">Cover</option>
                <option value="contain">Contain</option>
                <option value="auto">Auto</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-slate-500">Position</label>
              <select value={background.position || 'center'} onChange={(event) => update({ position: event.target.value as MobileBackground['position'] })} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs">
                <option value="center">Center</option>
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-1">
        <label className="text-[11px] font-medium text-slate-500">Opacity: {Math.round((background.opacity ?? 1) * 100)}%</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={background.opacity ?? 1}
          onChange={(event) => update({ opacity: Number(event.target.value) })}
        />
      </div>
    </div>
  );
}
