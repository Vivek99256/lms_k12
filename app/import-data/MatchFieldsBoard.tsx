'use client';

import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MatchField = { field: string; display_field: string };

type ColumnId = 'unmatched' | 'matched';

function FieldItem({ field, columnId }: { field: MatchField; columnId: ColumnId }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.field,
    data: { columnId },
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn(
        'flex cursor-grab items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm active:cursor-grabbing',
        isDragging && 'opacity-40'
      )}
    >
      <GripVertical className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
      <span className="flex-1 truncate font-medium text-slate-800">{field.display_field}</span>
    </li>
  );
}

function Column({
  id,
  title,
  description,
  fields,
  emptyLabel,
}: {
  id: ColumnId;
  title: string;
  description: string;
  fields: MatchField[];
  emptyLabel: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-slate-200 bg-slate-50/60">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <ul
        ref={setNodeRef}
        className={cn('flex min-h-[220px] flex-1 flex-col gap-2 p-3 transition-colors', isOver && 'bg-blue-50/70')}
      >
        <SortableContext items={fields.map((f) => f.field)} strategy={verticalListSortingStrategy}>
          {fields.map((field) => (
            <FieldItem key={field.field} field={field} columnId={id} />
          ))}
        </SortableContext>
        {fields.length === 0 && (
          <li className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-300 py-8 text-xs text-slate-400">
            {emptyLabel}
          </li>
        )}
      </ul>
    </div>
  );
}

export default function MatchFieldsBoard({
  unmatched,
  matched,
  onChange,
}: {
  unmatched: MatchField[];
  matched: MatchField[];
  onChange: (next: { unmatched: MatchField[]; matched: MatchField[] }) => void;
}) {
  const [activeField, setActiveField] = useState<MatchField | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const byField = useMemo(() => {
    const map = new Map<string, MatchField>();
    [...unmatched, ...matched].forEach((f) => map.set(f.field, f));
    return map;
  }, [unmatched, matched]);

  const columnOf = (fieldName: string): ColumnId =>
    matched.some((f) => f.field === fieldName) ? 'matched' : 'unmatched';

  // closestCorners can resolve a cross-container drop to a nearby item still
  // inside the source column, which silently no-ops the move. Prefer the
  // droppable the pointer is literally over, falling back to rect overlap.
  const collisionDetection: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    return rectIntersection(args);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const field = byField.get(String(event.active.id));
    setActiveField(field ?? null);
  };

  const moveIfCrossColumn = (event: DragOverEvent | DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const sourceColumn = columnOf(activeId);
    const overId = String(over.id);
    const targetColumn: ColumnId = overId === 'unmatched' || overId === 'matched' ? (overId as ColumnId) : columnOf(overId);

    if (sourceColumn === targetColumn) return;

    const field = byField.get(activeId);
    if (!field) return;

    if (targetColumn === 'matched') {
      onChange({
        unmatched: unmatched.filter((f) => f.field !== activeId),
        matched: [...matched, field],
      });
    } else {
      onChange({
        matched: matched.filter((f) => f.field !== activeId),
        unmatched: [...unmatched, field],
      });
    }
  };

  // Reparent live as the pointer crosses into the other column, so the drop
  // doesn't depend on dragEnd resolving the correct target collision.
  const handleDragOver = (event: DragOverEvent) => moveIfCrossColumn(event);

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveField(null);
    moveIfCrossColumn(event);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col gap-4 sm:flex-row">
        <Column
          id="unmatched"
          title="Available fields"
          description="Drag a field to Matched to include it in this import."
          fields={unmatched}
          emptyLabel="All fields matched"
        />
        <div className="hidden shrink-0 items-center justify-center sm:flex">
          <ArrowRightLeft className="size-4 text-slate-300" aria-hidden="true" />
        </div>
        <Column
          id="matched"
          title="Matched fields"
          description="These fields will be available to map to CSV columns next."
          fields={matched}
          emptyLabel="Drag fields here to match them"
        />
      </div>
      <DragOverlay>
        {activeField ? (
          <li className="flex cursor-grabbing list-none items-center gap-2 rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm shadow-md">
            <GripVertical className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
            <span className="flex-1 truncate font-medium text-slate-800">{activeField.display_field}</span>
          </li>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
