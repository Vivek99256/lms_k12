'use client';

import { useEffect, useRef } from 'react';
import { Eraser, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * A small sketch pad for the lab notebook. Works with mouse, pen and touch.
 * The drawing is handed back as a compact JPEG data URL when a stroke ends.
 */

const W = 560;
const H = 280;
const COLOURS = ['#0f172a', '#dc2626', '#2563eb', '#16a34a'];

export function DrawingPad({
  value,
  onChange,
  disabled = false,
}: {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const colour = useRef(COLOURS[0]);
  const erase = useRef(false);
  const loaded = useRef<string | null>(null);

  const paintBackground = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
  };

  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    if (value === loaded.current) return;
    loaded.current = value;
    paintBackground(ctx);
    if (!value) return;
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, W, H);
    img.src = value;
  }, [value]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const ctx = e.currentTarget.getContext('2d');
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const { x, y } = point(e);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = erase.current ? 18 : 3;
    ctx.strokeStyle = erase.current ? '#ffffff' : colour.current;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.01, y + 0.01);
    ctx.stroke();
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext('2d');
    if (!ctx) return;
    const { x, y } = point(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const end = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    const url = e.currentTarget.toDataURL('image/jpeg', 0.6);
    loaded.current = url;
    onChange(url);
  };

  const clear = () => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    paintBackground(ctx);
    loaded.current = null;
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={canvas}
        width={W}
        height={H}
        aria-label="Drawing area for your diagram"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        className="w-full touch-none rounded-lg border border-slate-300 bg-white"
        style={{ aspectRatio: `${W} / ${H}`, cursor: disabled ? 'not-allowed' : 'crosshair' }}
      />
      {disabled ? null : (
        <div className="flex flex-wrap items-center gap-2">
          {COLOURS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Pen colour ${c}`}
              onClick={() => {
                colour.current = c;
                erase.current = false;
              }}
              className="h-6 w-6 rounded-full border border-slate-300"
              style={{ background: c }}
            />
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              erase.current = true;
            }}
            className="h-7 gap-1 text-xs"
          >
            <Eraser className="h-3 w-3" /> Eraser
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={clear} className="h-7 gap-1 text-xs">
            <Trash2 className="h-3 w-3" /> Clear
          </Button>
        </div>
      )}
    </div>
  );
}
