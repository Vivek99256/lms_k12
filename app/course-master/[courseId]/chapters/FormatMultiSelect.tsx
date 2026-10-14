'use client';

import { useMemo } from 'react';

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsActions,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from '@/components/ui/combobox';
import type { FormatCard } from '@/lib/question-generation/generatable-formats';

/**
 * The "Question format(s)" field of the Generate AI questions modal: a searchable
 * multi-select whose chosen formats show as removable chips.
 *
 * NOTHING HERE LISTS A FORMAT. The options are the cards built from whatever the
 * backend's formats endpoint returned (`toFormatCards`), so a format the catalogue
 * and the generator both gain appears with no change to this file. Each option shows
 * only what is already known about it -- label, code, marks and the H5P type the
 * existing map names for it -- and nothing is recomputed or duplicated here.
 *
 * The value is the list of selected codes, in the order they were picked. The server
 * orders them by its own registry before splitting the total, so click order never
 * changes what is generated.
 */
export function FormatMultiSelect({
  cards,
  value,
  onChange,
  disabled = false,
}: {
  cards: FormatCard[];
  value: string[];
  onChange: (codes: string[]) => void;
  disabled?: boolean;
}) {
  const anchor = useComboboxAnchor();
  const byCode = useMemo(() => new Map(cards.map((card) => [card.code, card])), [cards]);
  const codes = useMemo(() => cards.map((card) => card.code), [cards]);
  const labelFor = (code: string) => byCode.get(code)?.label ?? code;

  return (
    <Combobox
      multiple
      items={codes}
      value={value}
      onValueChange={(next) => onChange(Array.isArray(next) ? (next as string[]) : [])}
      itemToStringLabel={labelFor}
      disabled={disabled}
    >
      <ComboboxChips ref={anchor}>
        <ComboboxValue>
          {(selected: string[]) => (
            <>
              {selected.map((code) => (
                <ComboboxChip key={code} removeLabel={`Remove ${labelFor(code)}`}>
                  {labelFor(code)}
                </ComboboxChip>
              ))}
              <ComboboxChipsInput
                aria-label="Question formats"
                placeholder={selected.length === 0 ? 'Select question format(s)' : ''}
              />
            </>
          )}
        </ComboboxValue>
        <ComboboxChipsActions hasValue={value.length > 0} clearLabel="Clear all formats" />
      </ComboboxChips>

      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>No matching question format.</ComboboxEmpty>
        <ComboboxList>
          {(code: string) => {
            const card = byCode.get(code);
            if (!card) return null;

            return (
              <ComboboxItem key={code} value={code}>
                <span className="flex flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-[14px] font-semibold text-slate-900">{card.label}</span>
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10.5px] text-slate-600">
                      {card.code}
                    </code>
                    <span className="text-[11.5px] text-slate-500">{card.marks}</span>
                  </span>
                  <span
                    className="text-[11.5px] leading-[17px] text-slate-500"
                    title={card.h5p.note || undefined}
                  >
                    {card.h5p.mapped ? (
                      <>
                        Plays as: {card.h5p.target ?? 'not playable yet'}
                        {!card.h5p.exact ? (
                          <span className="text-amber-700"> · closest built type</span>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-amber-700">Saved to the question bank only</span>
                    )}
                  </span>
                </span>
              </ComboboxItem>
            );
          }}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
