"use client";
import React, { useState } from "react";
import { useEditor, Element } from "@craftjs/core";
import { Type, UploadCloud, Shapes, Square, X, Circle, Triangle, Star, Hexagon, Frame, Wrench, LayoutGrid, Table, Settings, Code, Braces } from "lucide-react";

import { TextBlock } from "../blocks/TextBlock";
import { ImageBlock } from "../blocks/ImageBlock";
import { ContainerBlock } from "../blocks/ContainerBlock";
import { ShapeBlock } from "../blocks/ShapeBlock";
import { TableBlock } from "../blocks/TableBlock";
import { createStarterTableContent } from "../blocks/tableUtils";
import { SettingsPanel } from "./SettingsPanel";
import { JsonPreviewPanel } from "./JsonPreviewPanel";
import { MergeFieldPanel } from "./MergeFieldPanel";

/**
 * One entry on the tool rail.
 *
 * Deliberately mirrors the app sidebar's active treatment (app/components/
 * Sidebar.tsx): #0D6EFD on blue-50/80 with a left indicator bar, gray icons
 * when idle. The rail is the first thing a user sees on this screen, so it has
 * to read as the same product as the rest of the ERP.
 */
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
            className={`group relative flex w-16 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl py-2.5 text-[10px] font-semibold transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
                active
                    ? 'bg-blue-50/80 text-[#0D6EFD]'
                    : 'text-gray-500 hover:bg-gray-50/80 hover:text-gray-900'
            }`}
        >
            {active && (
                <span className="absolute top-1/2 left-0 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[#0D6EFD]" />
            )}
            <Icon
                size={20}
                strokeWidth={active ? 2.5 : 2}
                className={`shrink-0 transition-transform duration-300 ${
                    active ? 'scale-110' : 'text-gray-400 group-hover:scale-110 group-hover:text-gray-600'
                }`}
            />
            <span className="whitespace-nowrap">{label}</span>
        </button>
    );
}

export const Toolbox = ({ activeTab, setActiveTab, isFloatingToolbarVisible, toggleFloatingToolbar }: { activeTab: string | null, setActiveTab: (tab: string | null) => void, isFloatingToolbarVisible?: boolean, toggleFloatingToolbar?: () => void }) => {
    const { connectors, actions, query } = useEditor();
    
    const { activeSelectionId } = useEditor((state) => ({
        activeSelectionId: state.events.selected.size > 0 ? Array.from(state.events.selected)[0] as string : null
    }));

    const [uploadedImages, setUploadedImages] = useState<string[]>([]);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const previousSelectedRef = React.useRef<string | null>(null);

    React.useEffect(() => {
        if (!activeSelectionId) {
            previousSelectedRef.current = null;
            return;
        }

        // Only trigger if the selection has actually changed to a NEW node
        if (activeSelectionId !== previousSelectedRef.current) {
            previousSelectedRef.current = activeSelectionId;
            
            const selectedNode = query.node(activeSelectionId).get();
            if (selectedNode && selectedNode.data) {
                const nodeName = selectedNode.data.name;
                console.log("Toolbox Auto-Open: Selected node changed to:", nodeName);
                // Auto-open settings (design) panel when content elements are selected
                const autoOpenSettingsNodes = [
                    'TextBlock', 'ImageBlock', 'ShapeBlock', 'DrawingBlock', 
                    'ButtonBlock', 'DividerBlock', 'LineBlock', 'TableBlock'
                ];
                
                if (autoOpenSettingsNodes.includes(nodeName)) {
                    setActiveTab('settings');
                }
            }
        }
    }, [activeSelectionId, query, setActiveTab]);

    // Track instance numbers for each shape type using ref to persist across re-renders
    const shapeCountersRef = React.useRef<Record<string, number>>({});

    // Cascades blocks inserted without a canvas click, so they don't stack.
    const fallbackInsertCountRef = React.useRef(0);

    // Helper function to get and increment shape instance counter
    const getShapeInstanceNumber = (shapeType: string): number => {
        const currentCount = shapeCountersRef.current[shapeType] || 0;
        const newCount = currentCount + 1;
        shapeCountersRef.current = { ...shapeCountersRef.current, [shapeType]: newCount };
        return newCount;
    };

    // Helper function to determine parent ID based on selection
    const getParentId = (): string => {
        if (activeSelectionId) {
            const selectedNode = query.node(activeSelectionId).get();
            if (selectedNode && selectedNode.data) {
                if (selectedNode.data.isCanvas) {
                    return activeSelectionId;
                }
            }
        }
        return "ROOT";
    };

    // ── Canva-like insertion point ──
    // Returns the last canvas click position (page coordinates).
    // If no recent click exists (>30s old or never clicked), falls back to
    // a reasonable center-ish position on the visible A4 page.
    const getInsertionPoint = (): { x: number; y: number } => {
        const lastClick = (window as any).__craft_last_click;
        if (lastClick && (Date.now() - lastClick.timestamp) < 30000) {
            // Clear the stored click so next insert doesn't reuse a stale position
            // Instead, offset slightly so consecutive inserts cascade
            const point = { x: lastClick.x, y: lastClick.y };
            // Nudge the stored position so rapid consecutive inserts cascade visually
            (window as any).__craft_last_click = {
                x: Math.min(lastClick.x + 20, 700),
                y: Math.min(lastClick.y + 20, 1050),
                timestamp: lastClick.timestamp,
            };
            return point;
        }
        // No recent click: drop onto the upper-left working area of the A4 page
        // (794x1123), cascading each successive insert. Without the cascade,
        // inserting several blocks in a row (e.g. picking merge fields from the
        // Fields panel) stacks them all at one point, where they overlap and
        // read as a single garbled block.
        const step = fallbackInsertCountRef.current % 12;
        fallbackInsertCountRef.current += 1;
        return { x: 120 + step * 24, y: 140 + step * 44 };
    };

    // Helper to insert a shape block at the insertion point
    const addShapeBlock = (shapeType: string) => {
        const pt = getInsertionPoint();
        const instanceNum = getShapeInstanceNumber(shapeType);
        const nodeTree = query.parseReactElement(
            <ShapeBlock shapeType={shapeType} instanceNumber={instanceNum} x={pt.x} y={pt.y} />
        ).toNodeTree();
        actions.addNodeTree(nodeTree, getParentId());
    };

    const toggleTab = (tab: string) => {
        setActiveTab(activeTab === tab ? null : tab);
    };

    return (
        <div className="relative flex h-full">
            {/* Tool rail — mirrors the app sidebar idiom (RailItem below). */}
            <div className="relative z-20 flex h-full w-20 shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-gray-100 bg-white py-4">
                <RailItem icon={Type} label="Text" active={activeTab === 'text'} onClick={() => toggleTab('text')} />
                <RailItem icon={UploadCloud} label="Uploads" active={activeTab === 'uploads'} onClick={() => toggleTab('uploads')} />
                <RailItem icon={Shapes} label="Shapes" active={activeTab === 'shapes'} onClick={() => toggleTab('shapes')} />
                <RailItem icon={Table} label="Tables" active={activeTab === 'tables'} onClick={() => toggleTab('tables')} />
                <RailItem icon={Frame} label="Frames" active={activeTab === 'frames'} onClick={() => toggleTab('frames')} />
                <RailItem icon={Braces} label="Fields" active={activeTab === 'fields'} onClick={() => toggleTab('fields')} />
                <RailItem icon={Wrench} label="Tools" active={Boolean(isFloatingToolbarVisible)} onClick={() => toggleFloatingToolbar && toggleFloatingToolbar()} />
                <RailItem icon={Settings} label="Settings" active={activeTab === 'settings'} onClick={() => toggleTab('settings')} />
                <RailItem icon={Code} label="Code" active={activeTab === 'json'} onClick={() => toggleTab('json')} />
            </div>

            {/* Slide Out Panel */}
            <div className={`absolute top-0 left-20 z-10 flex h-full flex-col border-r border-gray-100 bg-white shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-transform duration-300 ease-in-out ${activeTab ? 'translate-x-0' : '-translate-x-full'} ${activeTab === 'json' ? 'w-[350px]' : activeTab === 'settings' ? 'w-80' : 'w-72'}`}>

                {/* Panel Header */}
                {(activeTab !== 'settings' && activeTab !== 'json') && (
                    <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                        <h3 className="text-sm font-semibold capitalize text-gray-900">{activeTab || ''}</h3>
                        <button
                            type="button"
                            onClick={() => setActiveTab(null)}
                            aria-label="Close panel"
                            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-[#0D6EFD]"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {activeTab === 'settings' && <SettingsPanel onClose={() => setActiveTab(null)} />}
                {activeTab === 'json' && <JsonPreviewPanel onClose={() => setActiveTab(null)} />}

                {(activeTab !== 'settings' && activeTab !== 'json') && (
                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

                    {/* MERGE FIELDS TAB CONTENT */}
                    {activeTab === 'fields' && (
                        <MergeFieldPanel getInsertionPoint={getInsertionPoint} getParentId={getParentId} />
                    )}

                    {/* TEXT TAB CONTENT */}
                    {activeTab === 'text' && (
                        <>
                            <div
                                ref={(ref) => {
                                    if (ref) connectors.create(ref, <TextBlock />);
                                }}
                                onClick={() => { const pt = getInsertionPoint(); const nodeTree = query.parseReactElement(<TextBlock html="<p>Type your text here</p>" fontSize={16} width={300} x={pt.x} y={pt.y} />).toNodeTree(); actions.addNodeTree(nodeTree, getParentId()); }}
                                className="bg-[#0D6EFD] text-white rounded-xl p-3 flex items-center justify-center text-sm font-semibold cursor-pointer shadow-[0_4px_14px_0_rgba(14,165,233,0.39)] hover:shadow-[0_6px_20px_rgba(14,165,233,0.23)] hover:-translate-y-[1px] transition-all mb-4"
                            >
                                <Type className="w-4 h-4 mr-2" /> Add a text box
                            </div>

                            <div className="text-sm font-semibold text-slate-800 mb-2 mt-2">Default text styles</div>

                            <div className="flex flex-col gap-2">
                                <div
                                    ref={(ref) => {
                                        if (ref) connectors.create(ref, <TextBlock html="<h1>Add a heading</h1>" fontSize={36} bold={true} width={400} />);
                                    }}
                                    className="border border-blue-100/50 rounded-xl p-4 cursor-move hover:border-blue-300 hover:bg-blue-50 transition-all bg-white/80 shadow-sm flex items-center"
                                >
                                    <span className="text-3xl font-bold font-sans text-slate-800 leading-none tracking-tight">Add a heading</span>
                                </div>

                                <div
                                    ref={(ref) => {
                                        if (ref) connectors.create(ref, <TextBlock html="<h2>Add a subheading</h2>" fontSize={24} bold={true} width={300} />);
                                    }}
                                    className="border border-blue-100/50 rounded-xl p-4 cursor-move hover:border-blue-300 hover:bg-blue-50 transition-all bg-white/80 shadow-sm flex items-center"
                                >
                                    <span className="text-xl font-bold font-sans text-slate-700 leading-tight">Add a subheading</span>
                                </div>

                                <div
                                    ref={(ref) => {
                                        if (ref) connectors.create(ref, <TextBlock html="<p>Add a little bit of body text</p>" fontSize={16} width={250} />);
                                    }}
                                    className="border border-blue-100/50 rounded-xl p-3 cursor-move hover:border-blue-300 hover:bg-blue-50 transition-all bg-white/80 shadow-sm flex items-center"
                                >
                                    <span className="text-sm font-normal font-sans text-slate-600">Add a little bit of body text</span>
                                </div>
                            </div>
                        </>
                    )}

                    {/* UPLOADS TAB CONTENT */}
                    {activeTab === 'uploads' && (
                        <>
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                ref={fileInputRef}
                                className="hidden"
                                onChange={(e) => {
                                    const files = Array.from(e.target.files || []);
                                    files.forEach(file => {
                                        const reader = new FileReader();
                                        reader.onloadend = () => {
                                            if (typeof reader.result === 'string') {
                                                setUploadedImages(prev => [reader.result as string, ...prev]);
                                            }
                                        };
                                        reader.readAsDataURL(file);
                                    });
                                }}
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="bg-[#0D6EFD] text-white w-full py-2.5 rounded-xl text-sm font-medium shadow-[0_4px_14px_0_rgba(14,165,233,0.39)] hover:shadow-[0_6px_20px_rgba(14,165,233,0.23)] hover:-translate-y-[1px] transition-all mb-4"
                            >
                                Upload files
                            </button>

                            <div className="text-[10px] font-bold text-[#0D6EFD] uppercase tracking-widest mb-2">Images</div>

                            {uploadedImages.length === 0 ? (
                                <div className="text-center p-6 border-2 border-dashed border-slate-200 rounded-lg text-slate-400">
                                    <UploadCloud className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-xs">No images uploaded yet</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2">
                                    {uploadedImages.map((src, i) => (
                                        <div
                                            key={i}
                                            ref={(ref) => {
                                                if (ref) connectors.create(ref, <ImageBlock src={src} objectFit="contain" frameShape="none" />);
                                            }}
                                            className="aspect-square bg-slate-100 rounded-lg cursor-move overflow-hidden group relative flex items-center justify-center border border-slate-200 hover:border-primary transition-colors"
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={src} alt={`Uploaded ${i}`} className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <span className="text-white text-[10px] font-medium px-2 py-1 rounded bg-black/50">Drag to add</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {/* SHAPES TAB CONTENT */}
                    {activeTab === 'shapes' && (
                        <>
                            <div className="text-[10px] font-bold text-[#0D6EFD] uppercase tracking-widest mb-2">Shapes</div>
                            <div className="grid grid-cols-3 gap-2 mb-6">
                                <div
                                    ref={(ref) => {
                                        if (ref) connectors.create(ref, <ShapeBlock shapeType="square" instanceNumber={getShapeInstanceNumber('square')} />);
                                    }}
                                    onClick={() => addShapeBlock('square')}
                                    className="aspect-square bg-slate-50 border border-blue-100/50 rounded-xl cursor-move hover:bg-blue-50 hover:border-blue-300 hover:shadow-md transition-all flex items-center justify-center p-2"
                                    title="Square"
                                >
                                    <Square className="w-full h-full text-[#0D6EFD] fill-blue-400/20 drop-shadow-sm" />
                                </div>
                                <div
                                    ref={(ref) => {
                                        if (ref) connectors.create(ref, <ShapeBlock shapeType="rounded-square" instanceNumber={getShapeInstanceNumber('rounded-square')} />);
                                    }}
                                    onClick={() => addShapeBlock('rounded-square')}
                                    className="aspect-[1] bg-slate-50 border border-blue-100/50 rounded-2xl flex items-center justify-center p-2 cursor-move hover:bg-blue-50 hover:border-blue-300 hover:shadow-md transition-all group"
                                    title="Rounded Square"
                                >
                                    <div className="w-full h-full rounded-xl bg-blue-200/50 border border-blue-400 group-hover:bg-blue-300/60 transition-colors"></div>
                                </div>
                                <div
                                    ref={(ref) => {
                                        if (ref) connectors.create(ref, <ShapeBlock shapeType="circle" instanceNumber={getShapeInstanceNumber('circle')} />);
                                    }}
                                    onClick={() => addShapeBlock('circle')}
                                    className="aspect-[1] bg-slate-50 border border-blue-100/50 rounded-full flex items-center justify-center p-2 cursor-move hover:bg-blue-50 hover:border-blue-300 hover:shadow-md transition-all group"
                                    title="Circle"
                                >
                                    <div className="w-full h-full rounded-full bg-blue-200/50 border border-blue-400 group-hover:bg-blue-300/60 transition-colors"></div>
                                </div>
                                <div
                                    ref={(ref) => {
                                        if (ref) connectors.create(ref, <ShapeBlock shapeType="triangle" instanceNumber={getShapeInstanceNumber('triangle')} />);
                                    }}
                                    onClick={() => addShapeBlock('triangle')}
                                    className="aspect-square bg-slate-50 border border-blue-100/50 rounded-xl cursor-move hover:bg-blue-50 hover:border-blue-300 hover:shadow-md transition-all flex items-center justify-center"
                                    title="Triangle"
                                >
                                    <Triangle className="w-8 h-8 text-[#0D6EFD] fill-blue-400/20 drop-shadow-sm" />
                                </div>
                                <div
                                    ref={(ref) => {
                                        if (ref) connectors.create(ref, <ShapeBlock shapeType="star" instanceNumber={getShapeInstanceNumber('star')} />);
                                    }}
                                    onClick={() => addShapeBlock('star')}
                                    className="aspect-square bg-slate-50 border border-blue-100/50 rounded-xl cursor-move hover:bg-blue-50 hover:border-blue-300 hover:shadow-md transition-all flex items-center justify-center"
                                    title="Star"
                                >
                                    <Star className="w-8 h-8 text-[#0D6EFD] fill-blue-400/20 drop-shadow-sm" />
                                </div>
                                <div
                                    ref={(ref) => {
                                        if (ref) connectors.create(ref, <ShapeBlock shapeType="hexagon" instanceNumber={getShapeInstanceNumber('hexagon')} />);
                                    }}
                                    onClick={() => addShapeBlock('hexagon')}
                                    className="aspect-square bg-slate-50 border border-blue-100/50 rounded-xl cursor-move hover:bg-blue-50 hover:border-blue-300 hover:shadow-md transition-all flex items-center justify-center"
                                    title="Hexagon"
                                >
                                    <Hexagon className="w-8 h-8 text-[#0D6EFD] fill-blue-400/20 drop-shadow-sm" />
                                </div>
                                <div
                                    ref={(ref) => {
                                        if (ref) connectors.create(ref, <ShapeBlock shapeType="diamond" instanceNumber={getShapeInstanceNumber('diamond')} />);
                                    }}
                                    onClick={() => addShapeBlock('diamond')}
                                    className="aspect-square bg-slate-50 border border-blue-100/50 rounded-xl cursor-move hover:bg-blue-50 hover:border-blue-300 hover:shadow-md transition-all flex items-center justify-center"
                                    title="Diamond"
                                >
                                    <svg width="28" height="28" viewBox="0 0 100 100" className="text-[#0D6EFD] fill-blue-400/20 drop-shadow-sm"><polygon points="50,0 100,50 50,100 0,50" /></svg>
                                </div>
                                <div
                                    ref={(ref) => {
                                        if (ref) connectors.create(ref, <ShapeBlock shapeType="pentagon" instanceNumber={getShapeInstanceNumber('pentagon')} />);
                                    }}
                                    onClick={() => addShapeBlock('pentagon')}
                                    className="aspect-square bg-slate-50 border border-blue-100/50 rounded-xl cursor-move hover:bg-blue-50 hover:border-blue-300 hover:shadow-md transition-all flex items-center justify-center"
                                    title="Pentagon"
                                >
                                    <svg width="28" height="28" viewBox="0 0 100 100" className="text-[#0D6EFD] fill-blue-400/20 drop-shadow-sm"><polygon points="50,0 100,38 82,100 18,100 0,38" /></svg>
                                </div>
                                <div
                                    ref={(ref) => {
                                        if (ref) connectors.create(ref, <ShapeBlock shapeType="octagon" instanceNumber={getShapeInstanceNumber('octagon')} />);
                                    }}
                                    onClick={() => addShapeBlock('octagon')}
                                    className="aspect-square bg-slate-50 border border-blue-100/50 rounded-xl cursor-move hover:bg-blue-50 hover:border-blue-300 hover:shadow-md transition-all flex items-center justify-center"
                                    title="Octagon"
                                >
                                    <svg width="28" height="28" viewBox="0 0 100 100" className="text-[#0D6EFD] fill-blue-400/20 drop-shadow-sm"><polygon points="30,0 70,0 100,30 100,70 70,100 30,100 0,70 0,30" /></svg>
                                </div>
                                <div
                                    ref={(ref) => {
                                        if (ref) connectors.create(ref, <ShapeBlock shapeType="cross" instanceNumber={getShapeInstanceNumber('cross')} />);
                                    }}
                                    onClick={() => addShapeBlock('cross')}
                                    className="aspect-square bg-slate-50 border border-blue-100/50 rounded-xl cursor-move hover:bg-blue-50 hover:border-blue-300 hover:shadow-md transition-all flex items-center justify-center"
                                    title="Cross"
                                >
                                    <svg width="32" height="32" viewBox="0 0 100 100" className="text-[#0D6EFD] fill-blue-400/20 drop-shadow-sm"><polygon points="35,0 65,0 65,35 100,35 100,65 65,65 65,100 35,100 35,65 0,65 0,35 35,35" /></svg>
                                </div>
                                <div
                                    ref={(ref) => {
                                        if (ref) connectors.create(ref, <ShapeBlock shapeType="arrow" instanceNumber={getShapeInstanceNumber('arrow')} />);
                                    }}
                                    onClick={() => addShapeBlock('arrow')}
                                    className="aspect-square bg-slate-50 border border-blue-100/50 rounded-xl cursor-move hover:bg-blue-50 hover:border-blue-300 hover:shadow-md transition-all flex items-center justify-center"
                                    title="Arrow"
                                >
                                    <svg width="32" height="32" viewBox="0 0 100 100" className="text-[#0D6EFD] fill-blue-400/20 drop-shadow-sm"><polygon points="0,35 60,35 60,15 100,50 60,85 60,65 0,65" /></svg>
                                </div>
                                <div
                                    ref={(ref) => {
                                        if (ref) connectors.create(ref, <ShapeBlock shapeType="parallelogram" instanceNumber={getShapeInstanceNumber('parallelogram')} />);
                                    }}
                                    onClick={() => addShapeBlock('parallelogram')}
                                    className="aspect-square bg-slate-50 border border-blue-100/50 rounded-xl cursor-move hover:bg-blue-50 hover:border-blue-300 hover:shadow-md transition-all flex items-center justify-center"
                                    title="Parallelogram"
                                >
                                    <svg width="28" height="28" viewBox="0 0 100 100" className="text-[#0D6EFD] fill-blue-400/20 drop-shadow-sm"><polygon points="25,0 100,0 75,100 0,100" /></svg>
                                </div>
                                <div
                                    ref={(ref) => {
                                        if (ref) connectors.create(ref, <ShapeBlock shapeType="trapezoid" instanceNumber={getShapeInstanceNumber('trapezoid')} />);
                                    }}
                                    onClick={() => addShapeBlock('trapezoid')}
                                    className="aspect-square bg-slate-50 border border-blue-100/50 rounded-xl cursor-move hover:bg-blue-50 hover:border-blue-300 hover:shadow-md transition-all flex items-center justify-center"
                                    title="Trapezoid"
                                >
                                    <svg width="28" height="28" viewBox="0 0 100 100" className="text-[#0D6EFD] fill-blue-400/20 drop-shadow-sm"><polygon points="20,0 80,0 100,100 0,100" /></svg>
                                </div>
                                <div
                                    ref={(ref) => {
                                        if (ref) connectors.create(ref, <ShapeBlock shapeType="right-triangle" instanceNumber={getShapeInstanceNumber('right-triangle')} />);
                                    }}
                                    onClick={() => addShapeBlock('right-triangle')}
                                    className="aspect-square bg-slate-50 border border-blue-100/50 rounded-xl cursor-move hover:bg-blue-50 hover:border-blue-300 hover:shadow-md transition-all flex items-center justify-center"
                                    title="Right Triangle"
                                >
                                    <svg width="28" height="28" viewBox="0 0 100 100" className="text-[#0D6EFD] fill-blue-400/20 drop-shadow-sm"><polygon points="0,0 100,100 0,100" /></svg>
                                </div>
                                <div
                                    ref={(ref) => {
                                        if (ref) connectors.create(ref, <ShapeBlock shapeType="chevron" instanceNumber={getShapeInstanceNumber('chevron')} />);
                                    }}
                                    onClick={() => addShapeBlock('chevron')}
                                    className="aspect-square bg-slate-50 border border-blue-100/50 rounded-xl cursor-move hover:bg-blue-50 hover:border-blue-300 hover:shadow-md transition-all flex items-center justify-center"
                                    title="Chevron"
                                >
                                    <svg width="28" height="28" viewBox="0 0 100 100" className="text-[#0D6EFD] fill-blue-400/20 drop-shadow-sm"><polygon points="75,0 100,50 75,100 0,100 25,50 0,0" /></svg>
                                </div>
                                <div
                                    ref={(ref) => {
                                        if (ref) connectors.create(ref, <ShapeBlock shapeType="ribbon" instanceNumber={getShapeInstanceNumber('ribbon')} />);
                                    }}
                                    onClick={() => addShapeBlock('ribbon')}
                                    className="aspect-square bg-slate-50 border border-blue-100/50 rounded-xl cursor-move hover:bg-blue-50 hover:border-blue-300 hover:shadow-md transition-all flex items-center justify-center"
                                    title="Ribbon"
                                >
                                    <svg width="28" height="28" viewBox="0 0 100 100" className="text-[#0D6EFD] fill-blue-400/20 drop-shadow-sm"><polygon points="0,0 100,0 100,100 50,75 0,100" /></svg>
                                </div>
                                <div
                                    ref={(ref) => {
                                        if (ref) connectors.create(ref, <ShapeBlock shapeType="message" instanceNumber={getShapeInstanceNumber('message')} />);
                                    }}
                                    onClick={() => addShapeBlock('message')}
                                    className="aspect-square bg-slate-50 border border-blue-100/50 rounded-xl cursor-move hover:bg-blue-50 hover:border-blue-300 hover:shadow-md transition-all flex items-center justify-center"
                                    title="Message"
                                >
                                    <svg width="28" height="28" viewBox="0 0 100 100" className="text-[#0D6EFD] fill-blue-400/20 drop-shadow-sm"><polygon points="0,0 100,0 100,75 75,75 75,100 50,75 0,75" /></svg>
                                </div>
                                <div
                                    ref={(ref) => {
                                        if (ref) connectors.create(ref, <ShapeBlock shapeType="tag" instanceNumber={getShapeInstanceNumber('tag')} />);
                                    }}
                                    onClick={() => addShapeBlock('tag')}
                                    className="aspect-square bg-slate-50 border border-blue-100/50 rounded-xl cursor-move hover:bg-blue-50 hover:border-blue-300 hover:shadow-md transition-all flex items-center justify-center"
                                    title="Tag"
                                >
                                    <svg width="28" height="28" viewBox="0 0 100 100" className="text-[#0D6EFD] fill-blue-400/20 drop-shadow-sm"><polygon points="0,0 75,0 100,50 75,100 0,100" /></svg>
                                </div>
                                <div
                                    ref={(ref) => {
                                        if (ref) connectors.create(ref, <ShapeBlock shapeType="shield" instanceNumber={getShapeInstanceNumber('shield')} />);
                                    }}
                                    onClick={() => addShapeBlock('shield')}
                                    className="aspect-square bg-slate-50 border border-blue-100/50 rounded-xl cursor-move hover:bg-blue-50 hover:border-blue-300 hover:shadow-md transition-all flex items-center justify-center"
                                    title="Shield"
                                >
                                    <svg width="28" height="28" viewBox="0 0 100 100" className="text-[#0D6EFD] fill-blue-400/20 drop-shadow-sm"><polygon points="0,0 100,0 100,60 50,100 0,60" /></svg>
                                </div>
                                <div
                                    ref={(ref) => {
                                        if (ref) connectors.create(ref, <ShapeBlock shapeType="stairs" instanceNumber={getShapeInstanceNumber('stairs')} />);
                                    }}
                                    onClick={() => addShapeBlock('stairs')}
                                    className="aspect-square bg-slate-50 border border-blue-100/50 rounded-xl cursor-move hover:bg-blue-50 hover:border-blue-300 hover:shadow-md transition-all flex items-center justify-center"
                                    title="Stairs"
                                >
                                    <svg width="28" height="28" viewBox="0 0 100 100" className="text-[#0D6EFD] fill-blue-400/20 drop-shadow-sm"><polygon points="0,0 50,0 50,50 100,50 100,100 0,100" /></svg>
                                </div>
                                <div
                                    ref={(ref) => {
                                        if (ref) connectors.create(ref, <ShapeBlock shapeType="beveled" instanceNumber={getShapeInstanceNumber('beveled')} />);
                                    }}
                                    onClick={() => addShapeBlock('beveled')}
                                    className="aspect-square bg-slate-50 border border-blue-100/50 rounded-xl cursor-move hover:bg-blue-50 hover:border-blue-300 hover:shadow-md transition-all flex items-center justify-center"
                                    title="Beveled"
                                >
                                    <svg width="28" height="28" viewBox="0 0 100 100" className="text-[#0D6EFD] fill-blue-400/20 drop-shadow-sm"><polygon points="20,0 80,0 100,20 100,80 80,100 20,100 0,80 0,20" /></svg>
                                </div>
                            </div>
                        </>
                    )}

                    {/* TABLES TAB CONTENT */}
                    {activeTab === 'tables' && (
                        <TableTabContent query={query} actions={actions} getParentId={getParentId} />
                    )}

                    {/* FRAMES TAB CONTENT */}
                    {activeTab === 'frames' && (
                        <>
                            <div className="text-[10px] font-bold text-[#0D6EFD] uppercase tracking-widest mb-2">Frames</div>
                            <div className="grid grid-cols-3 gap-2 mb-6">
                                <div
                                    ref={(ref) => { if (ref) connectors.create(ref, <ImageBlock frameShape="none" />); }}
                                    className="aspect-square bg-blue-300 shadow-inner cursor-move hover:opacity-80 transition-opacity flex items-center justify-center rounded"
                                    title="Square Frame"
                                >
                                    <UploadCloud className="w-4 h-4 text-white" />
                                </div>
                                <div
                                    ref={(ref) => { if (ref) connectors.create(ref, <ImageBlock frameShape="circle" />); }}
                                    className="aspect-square bg-blue-300 shadow-inner cursor-move hover:opacity-80 transition-opacity flex items-center justify-center"
                                    style={{ clipPath: "circle(50% at 50% 50%)" }}
                                    title="Circle Frame"
                                >
                                    <UploadCloud className="w-4 h-4 text-white" />
                                </div>
                                <div
                                    ref={(ref) => { if (ref) connectors.create(ref, <ImageBlock frameShape="triangle" />); }}
                                    className="aspect-square bg-blue-300 shadow-inner cursor-move hover:opacity-80 transition-opacity flex items-center justify-center"
                                    style={{ clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" }}
                                    title="Triangle Frame"
                                >
                                    <UploadCloud className="w-4 h-4 text-white mt-4" />
                                </div>
                                <div
                                    ref={(ref) => { if (ref) connectors.create(ref, <ImageBlock frameShape="diamond" />); }}
                                    className="aspect-square bg-blue-300 shadow-inner cursor-move hover:opacity-80 transition-opacity flex items-center justify-center"
                                    style={{ clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" }}
                                    title="Diamond Frame"
                                >
                                    <UploadCloud className="w-4 h-4 text-white" />
                                </div>
                                <div
                                    ref={(ref) => { if (ref) connectors.create(ref, <ImageBlock frameShape="hexagon" />); }}
                                    className="aspect-square bg-blue-300 shadow-inner cursor-move hover:opacity-80 transition-opacity flex items-center justify-center"
                                    style={{ clipPath: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)" }}
                                    title="Hexagon Frame"
                                >
                                    <UploadCloud className="w-4 h-4 text-white" />
                                </div>
                                <div
                                    ref={(ref) => { if (ref) connectors.create(ref, <ImageBlock frameShape="star" />); }}
                                    className="aspect-square bg-blue-300 shadow-inner cursor-move hover:opacity-80 transition-opacity flex items-center justify-center"
                                    style={{ clipPath: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)" }}
                                    title="Star Frame"
                                >
                                    <UploadCloud className="w-4 h-4 text-white mt-2" />
                                </div>
                                <div
                                    ref={(ref) => { if (ref) connectors.create(ref, <ImageBlock frameShape="starburst" />); }}
                                    className="aspect-square bg-blue-300 shadow-inner cursor-move hover:opacity-80 transition-opacity flex items-center justify-center"
                                    style={{ clipPath: "polygon(50% 0%, 63% 15%, 85% 15%, 85% 37%, 100% 50%, 85% 63%, 85% 85%, 63% 85%, 50% 100%, 37% 85%, 15% 85%, 15% 63%, 0% 50%, 15% 37%, 15% 15%, 37% 15%)" }}
                                    title="Starburst Frame"
                                >
                                    <UploadCloud className="w-4 h-4 text-white" />
                                </div>
                                <div
                                    ref={(ref) => { if (ref) connectors.create(ref, <ImageBlock frameShape="pentagon" />); }}
                                    className="aspect-square bg-blue-300 shadow-inner cursor-move hover:opacity-80 transition-opacity flex items-center justify-center"
                                    style={{ clipPath: "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)" }}
                                    title="Pentagon Frame"
                                >
                                    <UploadCloud className="w-4 h-4 text-white mt-2" />
                                </div>
                                <div
                                    ref={(ref) => { if (ref) connectors.create(ref, <ImageBlock frameShape="octagon" />); }}
                                    className="aspect-square bg-blue-300 shadow-inner cursor-move hover:opacity-80 transition-opacity flex items-center justify-center"
                                    style={{ clipPath: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)" }}
                                    title="Octagon Frame"
                                >
                                    <UploadCloud className="w-4 h-4 text-white" />
                                </div>
                                <div
                                    ref={(ref) => { if (ref) connectors.create(ref, <ImageBlock frameShape="cross" />); }}
                                    className="aspect-square bg-blue-300 shadow-inner cursor-move hover:opacity-80 transition-opacity flex items-center justify-center"
                                    style={{ clipPath: "polygon(35% 0%, 65% 0%, 65% 35%, 100% 35%, 100% 65%, 65% 65%, 65% 100%, 35% 100%, 35% 65%, 0% 65%, 0% 35%, 35% 35%)" }}
                                    title="Cross Frame"
                                >
                                    <UploadCloud className="w-4 h-4 text-white" />
                                </div>
                                <div
                                    ref={(ref) => { if (ref) connectors.create(ref, <ImageBlock frameShape="arrow" />); }}
                                    className="aspect-square bg-blue-300 shadow-inner cursor-move hover:opacity-80 transition-opacity flex items-center justify-center"
                                    style={{ clipPath: "polygon(0% 35%, 60% 35%, 60% 15%, 100% 50%, 60% 85%, 60% 65%, 0% 65%)" }}
                                    title="Arrow Frame"
                                >
                                    <UploadCloud className="w-4 h-4 text-white" />
                                </div>
                                <div
                                    ref={(ref) => { if (ref) connectors.create(ref, <ImageBlock frameShape="parallelogram" />); }}
                                    className="aspect-square bg-blue-300 shadow-inner cursor-move hover:opacity-80 transition-opacity flex items-center justify-center"
                                    style={{ clipPath: "polygon(25% 0%, 100% 0%, 75% 100%, 0% 100%)" }}
                                    title="Parallelogram Frame"
                                >
                                    <UploadCloud className="w-4 h-4 text-white" />
                                </div>
                                <div
                                    ref={(ref) => { if (ref) connectors.create(ref, <ImageBlock frameShape="trapezoid" />); }}
                                    className="aspect-square bg-blue-300 shadow-inner cursor-move hover:opacity-80 transition-opacity flex items-center justify-center"
                                    style={{ clipPath: "polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)" }}
                                    title="Trapezoid Frame"
                                >
                                    <UploadCloud className="w-4 h-4 text-white" />
                                </div>
                                <div
                                    ref={(ref) => { if (ref) connectors.create(ref, <ImageBlock frameShape="right-triangle" />); }}
                                    className="aspect-square bg-slate-100 cursor-move hover:opacity-80 transition-opacity flex items-center justify-center"
                                    style={{ clipPath: "polygon(0% 0%, 100% 100%, 0% 100%)" }}
                                    title="Right Triangle Frame"
                                >
                                    <UploadCloud className="w-4 h-4 text-white" />
                                </div>
                                <div
                                    ref={(ref) => { if (ref) connectors.create(ref, <ImageBlock frameShape="chevron" />); }}
                                    className="aspect-square bg-slate-100 cursor-move hover:opacity-80 transition-opacity flex items-center justify-center"
                                    style={{ clipPath: "polygon(75% 0%, 100% 50%, 75% 100%, 0% 100%, 25% 50%, 0% 0%)" }}
                                    title="Chevron Frame"
                                >
                                    <UploadCloud className="w-4 h-4 text-white" />
                                </div>
                                <div
                                    ref={(ref) => { if (ref) connectors.create(ref, <ImageBlock frameShape="ribbon" />); }}
                                    className="aspect-square bg-slate-100 cursor-move hover:opacity-80 transition-opacity flex items-center justify-center"
                                    style={{ clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 50% 75%, 0% 100%)" }}
                                    title="Ribbon Frame"
                                >
                                    <UploadCloud className="w-4 h-4 text-white" />
                                </div>
                                <div
                                    ref={(ref) => { if (ref) connectors.create(ref, <ImageBlock frameShape="message" />); }}
                                    className="aspect-square bg-slate-100 cursor-move hover:opacity-80 transition-opacity flex items-center justify-center"
                                    style={{ clipPath: "polygon(0% 0%, 100% 0%, 100% 75%, 75% 75%, 75% 100%, 50% 75%, 0% 75%)" }}
                                    title="Message Frame"
                                >
                                    <UploadCloud className="w-4 h-4 text-white" />
                                </div>
                                <div
                                    ref={(ref) => { if (ref) connectors.create(ref, <ImageBlock frameShape="tag" />); }}
                                    className="aspect-square bg-slate-100 cursor-move hover:opacity-80 transition-opacity flex items-center justify-center"
                                    style={{ clipPath: "polygon(0% 0%, 75% 0%, 100% 50%, 75% 100%, 0% 100%)" }}
                                    title="Tag Frame"
                                >
                                    <UploadCloud className="w-4 h-4 text-white" />
                                </div>
                                <div
                                    ref={(ref) => { if (ref) connectors.create(ref, <ImageBlock frameShape="shield" />); }}
                                    className="aspect-square bg-slate-100 cursor-move hover:opacity-80 transition-opacity flex items-center justify-center"
                                    style={{ clipPath: "polygon(0% 0%, 100% 0%, 100% 60%, 50% 100%, 0% 60%)" }}
                                    title="Shield Frame"
                                >
                                    <UploadCloud className="w-4 h-4 text-white" />
                                </div>
                                <div
                                    ref={(ref) => { if (ref) connectors.create(ref, <ImageBlock frameShape="stairs" />); }}
                                    className="aspect-square bg-slate-100 cursor-move hover:opacity-80 transition-opacity flex items-center justify-center"
                                    style={{ clipPath: "polygon(0% 0%, 50% 0%, 50% 50%, 100% 50%, 100% 100%, 0% 100%)" }}
                                    title="Stairs Frame"
                                >
                                    <UploadCloud className="w-4 h-4 text-white" />
                                </div>
                                <div
                                    ref={(ref) => { if (ref) connectors.create(ref, <ImageBlock frameShape="beveled" />); }}
                                    className="aspect-square bg-slate-100 cursor-move hover:opacity-80 transition-opacity flex items-center justify-center"
                                    style={{ clipPath: "polygon(20% 0%, 80% 0%, 100% 20%, 100% 80%, 80% 100%, 20% 100%, 0% 80%, 0% 20%)" }}
                                    title="Beveled Frame"
                                >
                                    <UploadCloud className="w-4 h-4 text-white" />
                                </div>
                            </div>

                            <div className="text-[10px] font-bold text-[#0D6EFD] uppercase tracking-widest mb-2 mt-6">Container</div>
                            <div
                                ref={(ref) => { if (ref) connectors.create(ref, <Element canvas is={ContainerBlock} isOverlay={false} />); }}
                                onClick={() => { const pt = getInsertionPoint(); const nodeTree = query.parseReactElement(<Element canvas is={ContainerBlock} isOverlay={false} x={pt.x} y={pt.y} />).toNodeTree(); actions.addNodeTree(nodeTree, getParentId()); }}
                                className="bg-[#0D6EFD] text-white rounded-xl p-4 flex items-center justify-center text-sm font-semibold cursor-pointer shadow-[0_4px_14px_0_rgba(14,165,233,0.39)] hover:shadow-[0_6px_20px_rgba(14,165,233,0.23)] hover:-translate-y-[1px] transition-all mb-4"
                            >
                                <LayoutGrid className="w-4 h-4 mr-2" /> Add a Container
                            </div>
                        </>
                    )}

                </div>
                )}
            </div>
        </div>
    );
};

// ─── Custom Table Tab Content ────────────────────────────────────────

function TableTabContent({ query, actions, getParentId }: any) {
    const [customRows, setCustomRows] = React.useState(3);
    const [customCols, setCustomCols] = React.useState(4);

    const addTable = (r: number, c: number) => {
        const lastClick = (window as any).__craft_last_click;
        let pt = { x: 200, y: 200 };
        if (lastClick && (Date.now() - lastClick.timestamp) < 30000) {
            pt = { x: lastClick.x, y: lastClick.y };
            (window as any).__craft_last_click = { x: Math.min(lastClick.x + 20, 700), y: Math.min(lastClick.y + 20, 1050), timestamp: lastClick.timestamp };
        }

        // Constants for page layout
        const PAGE_CONTENT_START = 64; // py-4 (16px) + pt-12 (48px)
        const PAGE_HEIGHT = 1123;
        const PAGE_SPACING = PAGE_HEIGHT + 32; // page height + gap-8 (32px)
        const PAGE_WIDTH = 794;
        const TABLE_WIDTH = 540;

        // Determine the page index based on insertion point y
        const pageIndex = Math.max(0, Math.floor((pt.y - PAGE_CONTENT_START) / PAGE_SPACING));
        const pageTop = PAGE_CONTENT_START + pageIndex * PAGE_SPACING;

        // Center the table on the page
        const centerX = (PAGE_WIDTH - TABLE_WIDTH) / 2;
        const centerY = pageTop + PAGE_HEIGHT / 2 - 100; // Rough center, assuming table height ~200px

        const nodeTree = query.parseReactElement(
            <TableBlock rows={r} cols={c} content={createStarterTableContent(r, c)} x={centerX} y={centerY} />
        ).toNodeTree();
        actions.addNodeTree(nodeTree, getParentId());
    };

    const presets = [
        { r: 2, c: 2, label: "2×2" },
        { r: 3, c: 3, label: "3×3" },
        { r: 4, c: 4, label: "4×4" },
        { r: 2, c: 3, label: "2×3" },
        { r: 3, c: 4, label: "3×4" },
        { r: 5, c: 5, label: "5×5" },
    ];

    return (
        <>
            <div className="text-[10px] font-bold text-[#0D6EFD] uppercase tracking-widest mb-2">Tables</div>

            <div
                onClick={() => addTable(customRows, customCols)}
                className="bg-[#0D6EFD] text-white rounded-xl p-3 flex items-center justify-center text-sm font-semibold cursor-pointer shadow-[0_4px_14px_0_rgba(14,165,233,0.39)] hover:shadow-[0_6px_20px_rgba(14,165,233,0.23)] hover:-translate-y-[1px] transition-all mb-4"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M12 3v18"/><path d="M3 12h18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>
                Add a Table ({customRows}×{customCols})
            </div>

            <div className="text-[10px] font-bold text-[#0D6EFD] uppercase tracking-widest mb-2 mt-2">Quick Add</div>

            <div className="grid grid-cols-3 gap-2">
                {presets.map(p => (
                    <div
                        key={p.label}
                        onClick={() => addTable(p.r, p.c)}
                        className="aspect-square bg-slate-50 border border-blue-100/50 rounded-xl cursor-pointer hover:bg-blue-50 hover:border-blue-300 hover:shadow-md transition-all flex flex-col items-center justify-center p-2"
                        title={`${p.label} Table`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#0D6EFD]"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>
                        <span className="text-[10px] text-[#0D6EFD] mt-1">{p.label}</span>
                    </div>
                ))}
            </div>

            <div className="text-[10px] font-bold text-[#0D6EFD] uppercase tracking-widest mb-2 mt-4">Custom Table</div>

            <div className="bg-slate-50 border border-blue-100/50 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                    <div className="flex-1">
                        <label className="text-[10px] text-slate-500 block mb-0.5">Rows</label>
                        <input
                            type="number" min={1} max={20}
                            value={customRows}
                            onChange={(e) => setCustomRows(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                            className="w-full border border-blue-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:border-blue-400"
                        />
                    </div>
                    <span className="text-slate-300 text-lg mt-3">×</span>
                    <div className="flex-1">
                        <label className="text-[10px] text-slate-500 block mb-0.5">Cols</label>
                        <input
                            type="number" min={1} max={20}
                            value={customCols}
                            onChange={(e) => setCustomCols(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                            className="w-full border border-blue-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:border-blue-400"
                        />
                    </div>
                </div>
                <button
                    onClick={() => addTable(customRows, customCols)}
                    className="w-full bg-[#0D6EFD] hover:bg-[#0D6EFD] text-white text-xs font-semibold py-2 rounded-lg transition-colors shadow-sm"
                >
                    Insert {customRows}×{customCols} Table
                </button>
            </div>
        </>
    );
}
