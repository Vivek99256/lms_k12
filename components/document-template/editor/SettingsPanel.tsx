"use client";
import React from "react";
import { useEditor } from "@craftjs/core";
import { X } from "lucide-react";
import { Segmented } from "./ui";
import { LayersPanel } from "./LayersPanel";

type SettingsTab = "content" | "design" | "layers";

export const SettingsPanel = ({ onClose }: { onClose?: () => void }) => {
    const [tab, setTab] = React.useState<SettingsTab>("design");
    const { selected, isEnabled } = useEditor((state, query) => {
        const currentNodeId = query.getEvent("selected").first();
        let selected;

        if (currentNodeId) {
            const node = state.nodes[currentNodeId];
            const nodeName = node?.data?.name as string;
            const props = node?.data?.props || {};
            
            // Map of component names to their displayName functions
            const displayNameMap: Record<string, (p: any) => string> = {
                'ShapeBlock': (p: any) => {
                    const shapeNames: Record<string, string> = {
                        'square': 'Square',
                        'rounded-square': 'Rounded Square',
                        'circle': 'Circle',
                        'triangle': 'Triangle',
                        'diamond': 'Diamond',
                        'pentagon': 'Pentagon',
                        'hexagon': 'Hexagon',
                        'octagon': 'Octagon',
                        'star': 'Star',
                        'cross': 'Cross',
                        'arrow': 'Arrow',
                        'parallelogram': 'Parallelogram',
                        'trapezoid': 'Trapezoid',
                        'right-triangle': 'Right Triangle',
                        'chevron': 'Chevron',
                        'ribbon': 'Ribbon',
                        'message': 'Message',
                        'tag': 'Tag',
                        'shield': 'Shield',
                        'stairs': 'Stairs',
                        'beveled': 'Beveled',
                    };
                    const shapeType = p?.shapeType || 'square';
                    const baseName = shapeNames[shapeType] || `Shape ${shapeType}`;
                    // Check for instanceNumber prop
                    const instanceNum = p?.instanceNumber;
                    return instanceNum ? `${baseName} ${instanceNum}` : baseName;
                },
                'TextBlock': (p: any) => p?.html ? `Text: ${p.html.substring(0, 20)}...` : 'Text',
                'ImageBlock': (p: any) => p?.src ? `Image: ${p.src.substring(0, 15)}...` : 'Image',
                'ContainerBlock': (p: any) => {
                    // Check for instanceNumber prop
                    const instanceNum = p?.instanceNumber;
                    return instanceNum ? `Container ${instanceNum}` : 'Container';
                },
                'ButtonBlock': (p: any) => {
                    // Check for instanceNumber prop
                    const instanceNum = p?.instanceNumber;
                    return instanceNum ? `Button ${instanceNum}` : 'Button';
                },
                'DividerBlock': () => 'Divider',
                'GridBlock': () => 'Grid',
                'TableBlock': () => 'Table',
                'DrawingBlock': () => 'Drawing',
                'LineBlock': (p: any) => `Line: ${p?.lineType || 'default'}`,
            };
            
            // Get display name - check custom map first, then fallback
            let displayName: string;
            if (nodeName && displayNameMap[nodeName]) {
                displayName = displayNameMap[nodeName](props);
            } else {
                displayName = nodeName || `Block ${currentNodeId.slice(0, 8)}`;
            }

            selected = {
                id: currentNodeId,
                name: displayName,
                settings:
                    node?.related &&
                    node?.related?.settings,
                props: node?.data?.props,
                isDeletable: query.node(currentNodeId).isDeletable(),
            };
        }

        return {
            selected,
            isEnabled: state.options.enabled,
        };
    });

    return (
        <div className="relative z-20 flex h-full w-full flex-col">
            <div className="flex shrink-0 flex-row items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
                <h3 className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                    Settings
                </h3>
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close settings"
                        className="rounded-lg p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    >
                        <X className="size-4" />
                    </button>
                )}
            </div>
            <div className="w-full flex-1 overflow-y-auto">
                {selected ? (
                    <>
                        <Segmented<SettingsTab>
                            value={tab}
                            onChange={setTab}
                            options={[
                                { value: "content", label: "Content" },
                                { value: "design", label: "Design" },
                                { value: "layers", label: "Layers" },
                            ]}
                        />

                        {tab === "content" && (
                            <div className="p-4">
                                <div className="mb-4 border-b border-slate-200 pb-2 text-xs text-slate-500">
                                    Selected block: <span className="font-mono text-slate-800">{selected.name}</span>
                                </div>
                                {selected.settings ? (
                                    React.createElement(selected.settings)
                                ) : (
                                    <p className="text-sm text-slate-500">No content settings for this block.</p>
                                )}
                            </div>
                        )}

                        {tab === "design" && (
                            <div className="flex flex-col gap-6 p-4">
                                {selected.settings ? (
                                    React.createElement(selected.settings, { isDesignTab: true })
                                ) : (
                                    <p className="text-sm text-slate-500">No design settings for this block.</p>
                                )}
                            </div>
                        )}

                        {tab === "layers" && (
                            <div className="max-h-[70vh] min-h-[300px] w-full overflow-y-auto">
                                <LayersPanel />
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex h-40 items-center justify-center p-4 text-center text-sm text-slate-500">
                        Select a block on the canvas to edit its properties.
                    </div>
                )}
            </div>
        </div>
    );
};
