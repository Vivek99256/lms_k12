'use client';

import React, { useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { MobileAction } from '../../shared/layoutTypes';

const fieldClass =
  'h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20';
const labelClass = 'text-[11px] font-medium text-slate-500';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

function emptyAction(): MobileAction {
  return { type: 'none' };
}

/**
 * Configures what a Button does: nothing, a client-side navigation, or an
 * API request. This is the ONE place in the whole builder that names an
 * endpoint + method -- validated server-side (relative path, allowlisted
 * verb) by MobilePageLayoutValidator.php, and executed at runtime by the
 * viewer's own authenticated request (see app/mobile/custom/[slug]/page.tsx)
 * -- never by this app or Laravel calling it on the admin's behalf.
 */
export const ActionControl = ({
  action,
  onChange,
}: {
  action?: MobileAction | null;
  onChange: (next: MobileAction) => void;
}) => {
  const current = action ?? emptyAction();

  const update = useCallback(
    (patch: Partial<MobileAction>) => onChange({ ...current, ...patch }),
    [current, onChange]
  );

  const bodyEntries = Object.entries(current.body ?? {});

  const setBodyEntry = (index: number, key: string, value: string) => {
    const next = [...bodyEntries];
    next[index] = [key, value];
    update({ body: Object.fromEntries(next) });
  };

  const removeBodyEntry = (index: number) => {
    const next = bodyEntries.filter((_, i) => i !== index);
    update({ body: Object.fromEntries(next) });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className={labelClass}>Action</label>
        <select
          value={current.type}
          onChange={(event) => {
            const type = event.target.value as MobileAction['type'];
            if (type === 'api') update({ type, method: current.method ?? 'POST', endpoint: current.endpoint ?? '' });
            else if (type === 'navigate') update({ type, navigate: current.navigate ?? { kind: 'page', slug: '' } });
            else update({ type });
          }}
          className={fieldClass}
        >
          <option value="none">None</option>
          <option value="navigate">Navigate</option>
          <option value="api">API Request</option>
        </select>
      </div>

      {current.type === 'navigate' && (
        <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Go to</label>
            <select
              value={current.navigate?.kind ?? 'page'}
              onChange={(event) =>
                update({
                  navigate:
                    event.target.value === 'back'
                      ? { kind: 'back' }
                      : { kind: 'page', slug: current.navigate?.kind === 'page' ? current.navigate.slug : '' },
                })
              }
              className={fieldClass}
            >
              <option value="page">Another mobile page</option>
              <option value="back">Back</option>
            </select>
          </div>
          {current.navigate?.kind === 'page' && (
            <div className="flex flex-col gap-1">
              <label className={labelClass}>Page slug</label>
              <input
                type="text"
                value={current.navigate.slug}
                onChange={(event) => update({ navigate: { kind: 'page', slug: event.target.value } })}
                placeholder="student-profile"
                className={fieldClass}
              />
            </div>
          )}
        </div>
      )}

      {current.type === 'api' && (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="grid grid-cols-[100px_1fr] gap-2">
            <div className="flex flex-col gap-1">
              <label className={labelClass}>Method</label>
              <select
                value={current.method ?? 'POST'}
                onChange={(event) => update({ method: event.target.value as MobileAction['method'] })}
                className={fieldClass}
              >
                {METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass}>Endpoint</label>
              <input
                type="text"
                value={current.endpoint ?? ''}
                onChange={(event) => update({ endpoint: event.target.value })}
                placeholder="student/update"
                spellCheck={false}
                className={`${fieldClass} font-mono`}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className={labelClass}>Body fields</label>
              <button
                type="button"
                onClick={() => update({ body: { ...(current.body ?? {}), '': '' } })}
                className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-50"
              >
                <Plus className="size-3" /> Add
              </button>
            </div>
            {bodyEntries.length === 0 ? (
              <p className="text-[10px] text-slate-400">
                Map a field name to a literal value or a {'{{'}fieldName{'}}'} token that reads a sibling Input&apos;s value.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {bodyEntries.map(([key, value], index) => (
                  <div key={index} className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={key}
                      onChange={(event) => setBodyEntry(index, event.target.value, value)}
                      placeholder="name"
                      className={`${fieldClass} font-mono`}
                    />
                    <span className="text-slate-300">=</span>
                    <input
                      type="text"
                      value={value}
                      onChange={(event) => setBodyEntry(index, key, event.target.value)}
                      placeholder="{{student_name}}"
                      className={`${fieldClass} font-mono`}
                    />
                    <button
                      type="button"
                      onClick={() => removeBodyEntry(index)}
                      className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className={labelClass}>Success message</label>
              <input
                type="text"
                value={current.successMessage ?? ''}
                onChange={(event) => update({ successMessage: event.target.value })}
                placeholder="Saved."
                className={fieldClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass}>Error message</label>
              <input
                type="text"
                value={current.errorMessage ?? ''}
                onChange={(event) => update({ errorMessage: event.target.value })}
                placeholder="Could not save."
                className={fieldClass}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelClass}>After success</label>
            <select
              value={current.onSuccess?.type ?? 'reload'}
              onChange={(event) => {
                const type = event.target.value as NonNullable<MobileAction['onSuccess']>['type'];
                update({
                  onSuccess:
                    type === 'navigate' ? { type, target: { kind: 'page', slug: '' } } : { type },
                });
              }}
              className={fieldClass}
            >
              <option value="reload">Reload this page</option>
              <option value="goBack">Go back</option>
              <option value="navigate">Go to another page</option>
            </select>
            {current.onSuccess?.type === 'navigate' && (
              <input
                type="text"
                value={current.onSuccess.target?.kind === 'page' ? current.onSuccess.target.slug : ''}
                onChange={(event) =>
                  update({ onSuccess: { type: 'navigate', target: { kind: 'page', slug: event.target.value } } })
                }
                placeholder="page slug"
                className={`${fieldClass} mt-1`}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
