'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

import type { ExperimentModel } from '@/lib/experiment-builder/types';

/**
 * Sorting the variables of the investigation: every setting of the equipment on the bench, and what can be measured,
 * becomes a chip. The student puts one setting in "I will change", what they measure in "I will measure", and the
 * settings they keep the same in the third box. By tapping a chip then a box, or by dragging.
 *
 * Nothing is marked here. Whether the choices make a fair test shows in the trials, where a wrong choice has a
 * consequence the student can see, and in the hints and the report.
 */

export interface SortState {
  iv: string;
  dv: string;
  controls: string[];
}

type Box = 'change' | 'measure' | 'same' | 'pool';
type Chip = { id: string; label: string; kind: 'setting' | 'measure'; sub?: string };

function ChipView({ chip, held, locked, inBox, onHold, onTake }: { chip: Chip; held: string | null; locked: boolean; inBox: boolean; onHold: (id: string) => void; onTake: (id: string) => void }) {
  const isHeld = held === chip.id;
  return (
    <span
      draggable={!locked}
      onDragStart={(e) => e.dataTransfer.setData('text/plain', chip.id)}
      className={`inline-flex items-center gap-1 rounded-full border-2 px-3 py-1 text-xs font-semibold ${isHeld ? 'border-sky-600 bg-sky-100 text-sky-900' : chip.kind === 'measure' ? 'border-violet-300 bg-violet-50 text-violet-900' : 'border-slate-300 bg-white text-slate-800'} ${locked ? '' : 'cursor-grab'}`}
    >
      <button type="button" disabled={locked} onClick={(e) => { e.stopPropagation(); onHold(chip.id); }} aria-pressed={isHeld} data-testid={`chip-${chip.id}`}>
        {chip.label}
        {chip.sub ? <span className="ml-1 font-normal text-slate-500">({chip.sub})</span> : null}
      </button>
      {inBox && !locked ? (
        <button type="button" onClick={(e) => { e.stopPropagation(); onTake(chip.id); }} aria-label={`Take ${chip.label} out`} className="text-slate-400 hover:text-rose-600">
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </span>
  );
}

function DropBox({ id, title, hint, ready, locked, onDrop, children }: { id: Exclude<Box, 'pool'>; title: string; hint: string; ready: boolean; locked: boolean; onDrop: (chipId: string, box: Box) => void; children: React.ReactNode }) {
  return (
    <div
      role="group"
      aria-label={title}
      data-testid={`box-${id}`}
      onDragOver={(e) => !locked && e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const chipId = e.dataTransfer.getData('text/plain');
        if (chipId) onDrop(chipId, id);
      }}
      onClick={() => onDrop('', id)}
      className={`min-h-[96px] space-y-1.5 rounded-xl border-2 border-dashed p-3 ${ready ? 'cursor-pointer border-sky-500 bg-sky-50' : 'border-slate-300 bg-slate-50'}`}
    >
      <p className="text-sm font-bold text-slate-900">{title}</p>
      <p className="text-[11px] text-slate-500">{hint}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export function VariableSorter({
  model,
  settings,
  value,
  locked,
  onChange,
}: {
  model: ExperimentModel;
  settings: { key: string; label: string; item: string }[];
  value: SortState;
  locked: boolean;
  onChange: (next: SortState) => void;
}) {
  const [held, setHeld] = useState<string | null>(null);

  const chips: Chip[] = [
    ...settings.map((s): Chip => ({ id: `s:${s.key}`, label: s.label, kind: 'setting', sub: s.item })),
    ...model.measures.map((m): Chip => ({ id: `m:${m.id}`, label: m.label, kind: 'measure' })),
  ];
  const byId = new Map(chips.map((c) => [c.id, c]));

  /** Moves a chip to a box. An empty chip id means "the chip being held" (a tap on the box). */
  const place = (chipId: string, box: Box) => {
    const id = chipId || held;
    const chip = id ? byId.get(id) : undefined;
    if (!chip || locked) return;
    const key = chip.id.slice(2);
    let { iv, dv, controls } = value;
    if (chip.kind === 'setting') {
      if (iv === key) iv = '';
      controls = controls.filter((c) => c !== key);
    } else if (dv === key) {
      dv = '';
    }
    if (chip.kind === 'setting' && box === 'change') {
      iv = key;
    } else if (chip.kind === 'setting' && box === 'same') {
      controls = [...controls, key];
    } else if (chip.kind === 'measure' && box === 'measure') {
      dv = key;
    }
    onChange({ iv, dv, controls });
    setHeld(null);
  };

  const placed = new Set<string>([...(value.iv ? [`s:${value.iv}`] : []), ...(value.dv ? [`m:${value.dv}`] : []), ...value.controls.map((c) => `s:${c}`)]);
  const pool = chips.filter((c) => !placed.has(c.id));
  const heldKind = held ? byId.get(held)?.kind : undefined;
  // Tapping a chip that is already in a box, while another chip is held, puts the held chip in that box too.
  const view = (chip: Chip, box?: Exclude<Box, 'pool'>) => (
    <ChipView
      key={chip.id}
      chip={chip}
      held={held}
      locked={locked}
      inBox={!!box}
      onHold={(id) => (box && held && held !== id ? place(held, box) : setHeld(held === id ? null : id))}
      onTake={(id) => place(id, 'pool')}
    />
  );

  return (
    <div className="space-y-3">
      <div
        data-testid="pool"
        onDragOver={(e) => !locked && e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const chipId = e.dataTransfer.getData('text/plain');
          if (chipId) place(chipId, 'pool');
        }}
        className="flex min-h-[48px] flex-wrap gap-1.5 rounded-xl bg-slate-100 p-3"
      >
        {pool.length === 0 ? <p className="text-xs text-slate-500">Everything has been sorted.</p> : null}
        {pool.map((c) => view(c))}
      </div>
      <p className="text-[11px] text-slate-500">Tap a chip, then tap the box it belongs in. You can also drag it.</p>
      <div className="grid gap-3 md:grid-cols-3">
        <DropBox id="change" title="I will change" hint="Only one thing." ready={heldKind === 'setting'} locked={locked} onDrop={place}>
          {value.iv && byId.get(`s:${value.iv}`) ? view(byId.get(`s:${value.iv}`)!, 'change') : null}
        </DropBox>
        <DropBox id="measure" title="I will measure" hint="What the experiment tells you." ready={heldKind === 'measure'} locked={locked} onDrop={place}>
          {value.dv && byId.get(`m:${value.dv}`) ? view(byId.get(`m:${value.dv}`)!, 'measure') : null}
        </DropBox>
        <DropBox id="same" title="I will keep the same" hint="Everything else that could matter." ready={heldKind === 'setting'} locked={locked} onDrop={place}>
          {value.controls.map((c) => (byId.get(`s:${c}`) ? view(byId.get(`s:${c}`)!, 'same') : null))}
        </DropBox>
      </div>
    </div>
  );
}
