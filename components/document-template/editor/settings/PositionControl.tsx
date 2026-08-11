'use client';

import React from 'react';
import { ChevronsDown, ChevronsUp } from 'lucide-react';
import { FieldLabel, ToolButton } from '../ui';

interface PositionControlProps {
  isOverlay: boolean;
  x: number;
  y: number;
  zIndex: number;
  onChange: (prop: string, value: unknown) => void;
}

const numberFieldClass =
  'h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20';

export const PositionControl = ({ isOverlay, x, y, zIndex, onChange }: PositionControlProps) => {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <ToolButton
          variant={isOverlay ? 'outline' : 'default'}
          className="flex-1 justify-center"
          onClick={() => onChange('isOverlay', false)}
        >
          In flow
        </ToolButton>
        <ToolButton
          variant={isOverlay ? 'default' : 'outline'}
          className="flex-1 justify-center"
          onClick={() => {
            onChange('isOverlay', true);
            // Seed a sane origin so a block promoted to overlay doesn't jump to
            // an undefined position.
            if (x === undefined) onChange('x', 0);
            if (y === undefined) onChange('y', 0);
            if (zIndex === undefined) onChange('zIndex', 10);
          }}
        >
          Overlay
        </ToolButton>
      </div>

      {isOverlay && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <FieldLabel>X position</FieldLabel>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={x || 0}
                  onChange={(event) => onChange('x', Number(event.target.value))}
                  className={numberFieldClass}
                />
                <span className="text-[10px] text-slate-400">px</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <FieldLabel>Y position</FieldLabel>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={y || 0}
                  onChange={(event) => onChange('y', Number(event.target.value))}
                  className={numberFieldClass}
                />
                <span className="text-[10px] text-slate-400">px</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel>Layer order</FieldLabel>
            <div className="flex items-center gap-2">
              <ToolButton
                onClick={() => onChange('zIndex', Math.max(0, (zIndex || 0) - 1))}
                title="Send backward"
              >
                <ChevronsDown />
                Back
              </ToolButton>
              <input
                type="number"
                value={zIndex || 0}
                onChange={(event) => onChange('zIndex', Number(event.target.value))}
                className={`${numberFieldClass} w-16 text-center`}
              />
              <ToolButton onClick={() => onChange('zIndex', (zIndex || 0) + 1)} title="Bring forward">
                <ChevronsUp />
                Front
              </ToolButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
