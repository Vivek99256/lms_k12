'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Eraser, Link2, PencilLine, Plus, Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { BoardSpec, Workspace } from '@/app/pal/data/pal-explanation-workspace';

/**
 * A free board the student builds on: parts start in a tray at the bottom; the
 * student drags them where they want (into a named area, or anywhere), joins
 * them with arrows, adds their own labels and draws on top. Nothing is placed
 * for them and nothing tells them where a part belongs.
 */

export type WorkspacePatch = Partial<Workspace>;

/**
 * How the board is laid out for this many parts. A board with many parts gets a taller shape and a
 * taller tray, so every part has its own slot and none sits on top of another.
 */
function layoutFor(count: number) {
  const cols = count <= 3 ? Math.max(1, count) : 4;
  const rows = Math.max(1, Math.ceil(count / cols));
  return {
    cols,
    rows,
    aspect: count > 8 ? 1.25 : 1.6, // width / height
    trayTop: 1 - (0.07 + rows * 0.13),
    chipWidth: Math.floor(94 / cols),
  };
}
const COLOURS = ['#0f172a', '#dc2626', '#2563eb', '#16a34a'];
const INK_W = 800;
const INK_H = 500;

const clamp01 = (v: number) => Math.max(0.02, Math.min(0.98, v));

function zoneRects(zones: BoardSpec['zones'], trayTop: number) {
  const n = zones.length;
  if (n === 0) return [];
  const cols = Math.min(n, 3);
  const rows = Math.ceil(n / cols);
  const gap = 0.012;
  const h = (trayTop - 0.03 - gap * (rows - 1)) / rows;
  const w = (1 - 0.04 - gap * (cols - 1)) / cols;
  return zones.map((z, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    return { ...z, x: 0.02 + c * (w + gap), y: 0.02 + r * (h + gap), w, h };
  });
}

export function BoardWorkspace({
  spec,
  ws,
  locked,
  onChange,
}: {
  spec: BoardSpec;
  ws: Workspace;
  locked: boolean;
  onChange: (patch: WorkspacePatch, logLine?: string) => void;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const inkRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ id: string; extra: boolean; dx: number; dy: number } | null>(null);
  const drawing = useRef(false);
  const colour = useRef(COLOURS[0]);
  const erasing = useRef(false);
  const inkLoaded = useRef<string | null>(null);

  const [mode, setMode] = useState<'move' | 'connect' | 'draw'>('move');
  const [from, setFrom] = useState<string | null>(null);
  const [labelText, setLabelText] = useState('');
  const [live, setLive] = useState<Record<string, { x: number; y: number }>>({});

  const { cols, aspect: ASPECT, trayTop: TRAY_TOP, chipWidth } = useMemo(() => layoutFor(spec.items.length), [spec.items.length]);
  const zones = useMemo(() => zoneRects(spec.zones, TRAY_TOP), [spec.zones, TRAY_TOP]);
  const labelOf = useMemo(() => {
    const m = new Map<string, string>();
    spec.items.forEach((i) => m.set(i.id, i.label));
    ws.extras.forEach((e) => m.set(e.id, e.text));
    return m;
  }, [spec.items, ws.extras]);

  /** Where a part is drawn: where the student put it, or its slot in the tray. */
  const trayPos = (index: number) => ({
    x: ((index % cols) + 0.5) / cols,
    y: TRAY_TOP + 0.075 + Math.floor(index / cols) * 0.13,
  });
  const posOf = (id: string): { x: number; y: number } => {
    if (live[id]) return live[id];
    const p = ws.placements.find((q) => q.id === id);
    if (p) return { x: p.x, y: p.y };
    const e = ws.extras.find((q) => q.id === id);
    if (e) return { x: e.x, y: e.y };
    return trayPos(spec.items.findIndex((i) => i.id === id));
  };

  // Restore the drawing once.
  useEffect(() => {
    const c = inkRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx || ws.ink === inkLoaded.current) return;
    inkLoaded.current = ws.ink;
    ctx.clearRect(0, 0, INK_W, INK_H);
    if (!ws.ink) return;
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, INK_W, INK_H);
    img.src = ws.ink;
  }, [ws.ink]);

  const toBoard = (clientX: number, clientY: number) => {
    const r = boardRef.current!.getBoundingClientRect();
    return { x: (clientX - r.left) / r.width, y: (clientY - r.top) / r.height };
  };

  const zoneAt = (x: number, y: number) => zones.find((z) => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h)?.id ?? null;

  // --- dragging a part or a label ---------------------------------------------------
  const startDrag = (e: React.PointerEvent, id: string, extra: boolean) => {
    if (locked) return;
    if (mode === 'connect') {
      e.stopPropagation();
      if (!spec.allowArrows) return;
      if (from === null) setFrom(id);
      else if (from === id) setFrom(null);
      else {
        if (!ws.arrows.some((a) => a.from === from && a.to === id)) {
          onChange({ arrows: [...ws.arrows, { from, to: id, label: '' }] }, `joined ${labelOf.get(from)} to ${labelOf.get(id)}`);
        }
        setFrom(null);
      }
      return;
    }
    if (mode !== 'move') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toBoard(e.clientX, e.clientY);
    const c = posOf(id);
    drag.current = { id, extra, dx: c.x - p.x, dy: c.y - p.y };
  };

  const moveDrag = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = toBoard(e.clientX, e.clientY);
    setLive((l) => ({ ...l, [d.id]: { x: clamp01(p.x + d.dx), y: clamp01(p.y + d.dy) } }));
  };

  const endDrag = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const at = live[d.id];
    setLive((l) => {
      const { [d.id]: _gone, ...rest } = l;
      void _gone;
      return rest;
    });
    if (!at) return;
    if (d.extra) {
      onChange({ extras: ws.extras.map((x) => (x.id === d.id ? { ...x, x: at.x, y: at.y } : x)) }, `moved label "${labelOf.get(d.id)}"`);
      return;
    }
    const inTray = at.y >= TRAY_TOP;
    if (inTray) {
      onChange({ placements: ws.placements.filter((q) => q.id !== d.id), arrows: ws.arrows.filter((a) => a.from !== d.id && a.to !== d.id) }, `put ${labelOf.get(d.id)} back in the tray`);
      return;
    }
    const zone = zoneAt(at.x, at.y);
    const next = ws.placements.filter((q) => q.id !== d.id).concat({ id: d.id, x: at.x, y: at.y, zone });
    const zoneLabel = zone ? spec.zones.find((z) => z.id === zone)?.label : null;
    onChange({ placements: next }, zoneLabel ? `placed ${labelOf.get(d.id)} in "${zoneLabel}"` : `placed ${labelOf.get(d.id)} on the board`);
  };

  // --- labels --------------------------------------------------------------------------
  const addLabel = () => {
    const text = labelText.trim();
    if (!text || locked || ws.extras.length >= 20) return;
    const id = `e${Date.now().toString(36)}${ws.extras.length}`;
    onChange({ extras: [...ws.extras, { id, text: text.slice(0, 60), x: 0.5, y: 0.5 }] }, `added label "${text.slice(0, 60)}"`);
    setLabelText('');
  };

  const removeExtra = (id: string) =>
    onChange({ extras: ws.extras.filter((x) => x.id !== id), arrows: ws.arrows.filter((a) => a.from !== id && a.to !== id) }, `removed label "${labelOf.get(id)}"`);

  // --- drawing ---------------------------------------------------------------------------
  const inkPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * INK_W, y: ((e.clientY - r.top) / r.height) * INK_H };
  };
  const inkDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (locked || mode !== 'draw') return;
    const ctx = e.currentTarget.getContext('2d')!;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const { x, y } = inkPoint(e);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = erasing.current ? 22 : 4;
    ctx.globalCompositeOperation = erasing.current ? 'destination-out' : 'source-over';
    ctx.strokeStyle = colour.current;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.01, y + 0.01);
    ctx.stroke();
  };
  const inkMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext('2d')!;
    const { x, y } = inkPoint(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const inkEnd = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    let url = e.currentTarget.toDataURL('image/png');
    if (url.length > 190000) {
      // Too detailed to keep: store a half-size copy instead of losing it.
      const small = document.createElement('canvas');
      small.width = INK_W / 2;
      small.height = INK_H / 2;
      small.getContext('2d')!.drawImage(e.currentTarget, 0, 0, small.width, small.height);
      url = small.toDataURL('image/png');
    }
    inkLoaded.current = url;
    onChange({ ink: url.length <= 195000 ? url : ws.ink }, 'drew on the board');
  };
  const clearInk = () => {
    inkRef.current?.getContext('2d')?.clearRect(0, 0, INK_W, INK_H);
    inkLoaded.current = null;
    onChange({ ink: null }, 'cleared the drawing');
  };

  const chip = (id: string, text: string, extra: boolean) => {
    const p = posOf(id);
    const placed = extra || ws.placements.some((q) => q.id === id);
    const selected = from === id;
    return (
      <div
        key={id}
        role="button"
        tabIndex={0}
        aria-label={`${text}${placed ? '' : ' (in the tray)'}`}
        onPointerDown={(e) => startDrag(e, id, extra)}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 select-none rounded-lg border px-2.5 py-1.5 text-center text-xs font-semibold leading-tight shadow ${
          extra ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-sky-300 bg-white text-slate-900'
        } ${selected ? 'ring-2 ring-violet-500' : ''} ${locked ? 'cursor-default' : mode === 'move' ? 'cursor-grab touch-none active:cursor-grabbing' : mode === 'connect' ? 'cursor-pointer' : 'pointer-events-none'}`}
        style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, maxWidth: `${placed ? 30 : chipWidth}%` }}
      >
        {text}
        {extra && !locked ? (
          <button
            type="button"
            aria-label={`Remove label ${text}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => removeExtra(id)}
            className="ml-1 inline-flex align-middle text-amber-700"
          >
            <X className="h-3 w-3" />
          </button>
        ) : null}
      </div>
    );
  };

  const centre = (id: string) => {
    const p = posOf(id);
    return { x: p.x * ASPECT * 100, y: p.y * 100 };
  };

  return (
    <div className="space-y-3">
      {!locked ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant={mode === 'move' ? 'default' : 'outline'} onClick={() => { setMode('move'); setFrom(null); }} className="h-8 text-xs">
            Move
          </Button>
          {spec.allowArrows ? (
            <Button type="button" size="sm" variant={mode === 'connect' ? 'default' : 'outline'} onClick={() => { setMode('connect'); setFrom(null); }} className="h-8 gap-1 text-xs">
              <Link2 className="h-3.5 w-3.5" /> Join with arrows
            </Button>
          ) : null}
          {spec.allowDrawing ? (
            <Button type="button" size="sm" variant={mode === 'draw' ? 'default' : 'outline'} onClick={() => { setMode('draw'); setFrom(null); }} className="h-8 gap-1 text-xs">
              <PencilLine className="h-3.5 w-3.5" /> Draw
            </Button>
          ) : null}
          {mode === 'draw' ? (
            <>
              {COLOURS.map((c) => (
                <button key={c} type="button" aria-label={`Pen colour ${c}`} onClick={() => { colour.current = c; erasing.current = false; }} className="h-6 w-6 rounded-full border border-slate-300" style={{ background: c }} />
              ))}
              <Button type="button" size="sm" variant="outline" onClick={() => { erasing.current = true; }} className="h-8 gap-1 text-xs">
                <Eraser className="h-3.5 w-3.5" /> Eraser
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={clearInk} className="h-8 gap-1 text-xs">
                <Trash2 className="h-3.5 w-3.5" /> Clear drawing
              </Button>
            </>
          ) : null}
          <span className="text-[11px] text-slate-500" aria-live="polite">
            {mode === 'connect' ? (from ? `Now click the part to join "${labelOf.get(from)}" to.` : 'Click a part, then the part it connects to.') : mode === 'draw' ? 'Draw on the board.' : 'Drag parts onto the board.'}
          </span>
        </div>
      ) : null}

      <div
        ref={boardRef}
        data-testid="explanation-board"
        className="relative w-full overflow-hidden rounded-xl border-2 border-slate-300 bg-[linear-gradient(#f8fafc_1px,transparent_1px),linear-gradient(90deg,#f8fafc_1px,transparent_1px)] bg-[length:24px_24px] bg-white"
        style={{ aspectRatio: `${ASPECT}` }}
      >
        {zones.map((z) => (
          <div key={z.id} className="absolute rounded-lg border-2 border-dashed border-slate-300 bg-slate-50/70" style={{ left: `${z.x * 100}%`, top: `${z.y * 100}%`, width: `${z.w * 100}%`, height: `${z.h * 100}%` }}>
            <span className="absolute left-2 top-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">{z.label}</span>
          </div>
        ))}
        <div className="absolute inset-x-0 bottom-0 border-t-2 border-dashed border-slate-300 bg-slate-100/80" style={{ top: `${TRAY_TOP * 100}%` }}>
          <span className="absolute left-2 top-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Parts</span>
        </div>

        <svg className="pointer-events-none absolute inset-0 z-[5] h-full w-full" viewBox={`0 0 ${ASPECT * 100} 100`} preserveAspectRatio="none">
          <defs>
            <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 z" fill="#7c3aed" />
            </marker>
          </defs>
          {ws.arrows.map((a, i) => {
            const s = centre(a.from);
            const t = centre(a.to);
            const len = Math.hypot(t.x - s.x, t.y - s.y) || 1;
            const pad = 6;
            const x1 = s.x + ((t.x - s.x) / len) * pad;
            const y1 = s.y + ((t.y - s.y) / len) * pad;
            const x2 = t.x - ((t.x - s.x) / len) * pad;
            const y2 = t.y - ((t.y - s.y) / len) * pad;
            return (
              <g key={i}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#7c3aed" strokeWidth="0.6" markerEnd="url(#arrowhead)" />
                {a.label ? (
                  <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 1.2} fontSize="3" fill="#5b21b6" textAnchor="middle">
                    {a.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>

        {spec.items.map((i) => chip(i.id, i.label, false))}
        {ws.extras.map((e) => chip(e.id, e.text, true))}

        <canvas
          ref={inkRef}
          width={INK_W}
          height={INK_H}
          aria-label="Drawing layer"
          onPointerDown={inkDown}
          onPointerMove={inkMove}
          onPointerUp={inkEnd}
          onPointerCancel={inkEnd}
          className={`absolute inset-0 z-20 h-full w-full touch-none ${mode === 'draw' && !locked ? 'cursor-crosshair' : 'pointer-events-none'}`}
        />
      </div>

      {spec.allowLabels && !locked ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addLabel();
          }}
        >
          <input
            value={labelText}
            onChange={(e) => setLabelText(e.target.value)}
            maxLength={60}
            placeholder="Add your own label or note…"
            aria-label="Text for a new label"
            className="min-w-[12rem] flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <Button type="submit" size="sm" variant="outline" className="h-8 gap-1 text-xs" disabled={!labelText.trim()}>
            <Plus className="h-3.5 w-3.5" /> Add label
          </Button>
        </form>
      ) : null}

      {ws.arrows.length > 0 ? (
        <ul className="space-y-1.5" aria-label="Your arrows">
          {ws.arrows.map((a, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
              <span className="font-semibold">{labelOf.get(a.from)}</span>
              <span aria-hidden>→</span>
              <span className="font-semibold">{labelOf.get(a.to)}</span>
              <input
                value={a.label}
                disabled={locked}
                maxLength={60}
                onChange={(e) => onChange({ arrows: ws.arrows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
                placeholder="What does this arrow mean?"
                aria-label={`Meaning of the arrow from ${labelOf.get(a.from)} to ${labelOf.get(a.to)}`}
                className="min-w-[10rem] flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
              />
              {!locked ? (
                <button type="button" aria-label="Remove arrow" onClick={() => onChange({ arrows: ws.arrows.filter((_, j) => j !== i) }, 'removed an arrow')} className="text-slate-500 hover:text-rose-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
