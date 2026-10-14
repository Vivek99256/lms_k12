'use client';

/**
 * One row of the Summary section's "Mapping" list: a type dropdown and a dependent
 * value dropdown (options come from the server's mapping-options lookup, keyed by
 * type id), plus a remove button. Mirrors the old screen's mapping_type[]/
 * mapping_value[] row-adder.
 */

import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { LessonPlanMappingInput, LessonPlanMappingOptions } from '../../data/lessonPlanDocumentWrite';

export interface MappingRowProps {
  mapping: LessonPlanMappingInput;
  options: LessonPlanMappingOptions;
  onChange: (next: LessonPlanMappingInput) => void;
  onRemove: () => void;
  disabled?: boolean;
}

export function MappingRow({ mapping, options, onChange, onRemove, disabled }: MappingRowProps) {
  const valueOptions = mapping.type_id ? (options.values[mapping.type_id] ?? []) : [];
  const typeLabel = options.types.find((type) => type.id === mapping.type_id)?.name;
  const valueLabel = valueOptions.find((value) => value.id === mapping.value_id)?.name;

  return (
    <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
      <label className="block space-y-1.5">
        <span className="text-[12px] font-semibold text-slate-500">Mapping type</span>
        <Select
          value={mapping.type_id ? String(mapping.type_id) : undefined}
          onValueChange={(value) => onChange({ type_id: Number(value), value_id: 0 })}
          disabled={disabled}
        >
          <SelectTrigger className="h-10 rounded-lg">
            <SelectValue placeholder="Select type">{() => typeLabel ?? 'Select type'}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {options.types.map((type) => (
              <SelectItem key={type.id} value={String(type.id)}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <label className="block space-y-1.5">
        <span className="text-[12px] font-semibold text-slate-500">Mapping value</span>
        <Select
          value={mapping.value_id ? String(mapping.value_id) : undefined}
          onValueChange={(value) => onChange({ ...mapping, value_id: Number(value) })}
          disabled={disabled || !mapping.type_id}
        >
          <SelectTrigger className="h-10 rounded-lg">
            <SelectValue placeholder="Select value">{() => valueLabel ?? 'Select value'}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {valueOptions.map((value) => (
              <SelectItem key={value.id} value={String(value.id)}>
                {value.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label="Remove mapping" onClick={onRemove} className="text-slate-500 hover:text-rose-600">
        <Trash2 size={15} />
      </Button>
    </div>
  );
}
