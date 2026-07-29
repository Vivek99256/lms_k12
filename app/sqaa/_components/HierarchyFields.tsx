'use client';

import { useState } from 'react';
import { Field, NativeSelect } from '@/app/inward_outward/_components/shared';
import { loadSqaaLevels } from '../_lib/api';
import type { SqaaHierarchySelection, SqaaLevel } from '../_lib/types';

type LevelKey = keyof SqaaHierarchySelection;

export default function HierarchyFields({
  level1,
  value,
  onChange,
  onError,
  onLevel4Options,
}: {
  level1: SqaaLevel[];
  value: SqaaHierarchySelection;
  onChange: (value: SqaaHierarchySelection) => void;
  onError: (message: string) => void;
  onLevel4Options?: (options: SqaaLevel[]) => void;
}) {
  const [level2, setLevel2] = useState<SqaaLevel[]>([]);
  const [level3, setLevel3] = useState<SqaaLevel[]>([]);
  const [level4, setLevel4] = useState<SqaaLevel[]>([]);
  const [loadingKey, setLoadingKey] = useState<LevelKey | null>(null);

  async function select(key: LevelKey, selected: string) {
    if (key === 'level1') {
      onChange({ level1: selected, level2: '', level3: '', level4: '' });
      setLevel2([]);
      setLevel3([]);
      setLevel4([]);
      onLevel4Options?.([]);
      if (selected) await loadChildren(selected, 2, 'level2', setLevel2);
    }
    if (key === 'level2') {
      onChange({ ...value, level2: selected, level3: '', level4: '' });
      setLevel3([]);
      setLevel4([]);
      onLevel4Options?.([]);
      if (selected) await loadChildren(selected, 3, 'level3', setLevel3);
    }
    if (key === 'level3') {
      onChange({ ...value, level3: selected, level4: '' });
      setLevel4([]);
      onLevel4Options?.([]);
      if (selected) await loadChildren(selected, 4, 'level4', (options) => {
        setLevel4(options);
        onLevel4Options?.(options);
      });
    }
    if (key === 'level4') onChange({ ...value, level4: selected });
  }

  async function loadChildren(
    parentId: string,
    level: 2 | 3 | 4,
    key: LevelKey,
    save: (options: SqaaLevel[]) => void,
  ) {
    setLoadingKey(key);
    try {
      save(await loadSqaaLevels(parentId, level));
    } catch (error) {
      onError(error instanceof Error ? error.message : `Unable to load SQAA level ${level}.`);
    } finally {
      setLoadingKey(null);
    }
  }

  const fields: Array<{ key: LevelKey; options: SqaaLevel[]; disabled: boolean }> = [
    { key: 'level1', options: level1, disabled: false },
    { key: 'level2', options: level2, disabled: !value.level1 },
    { key: 'level3', options: level3, disabled: !value.level2 },
    { key: 'level4', options: level4, disabled: !value.level3 },
  ];

  return (
    <>
      {fields.map(({ key, options, disabled }, index) => (
        <Field key={key} label={`Select Level ${index + 1}`}>
          <NativeSelect
            value={value[key]}
            onChange={(selected) => void select(key, selected)}
            disabled={disabled || loadingKey === key}
          >
            <option value="">
              {loadingKey === key ? `Loading level ${index + 1}...` : `All level ${index + 1}`}
            </option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>{option.title}</option>
            ))}
          </NativeSelect>
        </Field>
      ))}
    </>
  );
}
