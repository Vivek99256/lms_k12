'use client';

import React, { useEffect } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { MOBILE_CANVAS_HEIGHT, MOBILE_CANVAS_WIDTH } from '../shared/layoutTypes';

/**
 * The fixed 375x812 phone frame the admin designs against -- the mobile
 * equivalent of the document-template editor's paginated A4 EditorCanvas,
 * but a single fixed screen rather than a stack of pages (a mobile page is
 * one scrollable screen, not paginated print output).
 *
 * Deliberately does NOT register its own Backspace/Delete handler:
 * OverlayWrapper (reused as-is by every block -- see its own doc) already
 * does, per selected node, with its own existence/parent/isDeletable checks.
 * An earlier version of this component added a second, redundant
 * window-level handler that raced with OverlayWrapper's document-level one
 * on the same keypress -- whichever ran second called query.node(id) on a
 * node the first had already deleted, throwing Craft.js's "Node does not
 * exist, it may have been removed" invariant.
 */
export const MobileEditorCanvas = ({ children }: { children: React.ReactNode }) => {
  const [zoom, setZoom] = React.useState(1);
  const [zoomMode, setZoomMode] = React.useState<'fit' | 'manual'>('fit');
  const containerRef = React.useRef<HTMLDivElement>(null);

  const fitToScreen = React.useCallback(() => {
    if (!containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    const widthRatio = (width - 80) / MOBILE_CANVAS_WIDTH;
    const heightRatio = (height - 80) / MOBILE_CANVAS_HEIGHT;
    setZoom(Math.max(0.3, Math.min(widthRatio, heightRatio, 1.5)));
    setZoomMode('fit');
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      if (zoomMode === 'fit') fitToScreen();
    });
    observer.observe(container);
    const timeout = setTimeout(() => {
      if (zoomMode === 'fit') fitToScreen();
    }, 50);
    return () => {
      observer.disconnect();
      clearTimeout(timeout);
    };
  }, [fitToScreen, zoomMode]);

  return (
    <div ref={containerRef} className="relative flex h-full w-full flex-1 items-center justify-center overflow-auto bg-slate-100">
      <div className="absolute bottom-6 right-8 z-50 flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 shadow-lg">
        <button onClick={() => { setZoomMode('manual'); setZoom((z) => Math.max(z - 0.1, 0.3)); }} className="rounded-full p-2 text-slate-600 hover:bg-slate-100">
          <ZoomOut className="size-4" />
        </button>
        <span className="w-12 text-center text-xs font-semibold text-slate-700">{Math.round(zoom * 100)}%</span>
        <button onClick={() => { setZoomMode('manual'); setZoom((z) => Math.min(z + 0.1, 2)); }} className="rounded-full p-2 text-slate-600 hover:bg-slate-100">
          <ZoomIn className="size-4" />
        </button>
        <div className="mx-1 h-4 w-px bg-slate-300" />
        <button
          onClick={fitToScreen}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${zoomMode === 'fit' ? 'bg-blue-100 text-[#0D6EFD]' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          Fit
        </button>
      </div>

      <div
        className="overflow-hidden rounded-[36px] border-[6px] border-slate-900 bg-white shadow-xl"
        style={{ width: MOBILE_CANVAS_WIDTH * zoom, height: MOBILE_CANVAS_HEIGHT * zoom, transition: 'width 0.15s ease-out, height 0.15s ease-out' }}
      >
        <div
          id="mobile-editor-canvas"
          style={{ width: MOBILE_CANVAS_WIDTH, height: MOBILE_CANVAS_HEIGHT, transform: `scale(${zoom})`, transformOrigin: 'top left' }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
