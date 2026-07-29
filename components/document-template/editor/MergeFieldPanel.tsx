'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useEditor } from '@craftjs/core';
import { ChevronDown, Loader2, Search } from 'lucide-react';

import { fetchMergeFields, type MergeFieldGroup } from '@/app/document-templates/api';
import { TextBlock } from '../blocks/TextBlock';
import { ToolButton, toast } from './ui';

/**
 * Merge fields — the school data a template can print.
 *
 * Clicking a field drops a text block holding its `{{token}}` onto the page.
 * The token stays literal in the saved template; it is resolved to a real value
 * only at preview/print time, so one template serves every student.
 */
export const MergeFieldPanel = ({
  getInsertionPoint,
  getParentId,
}: {
  getInsertionPoint: () => { x: number; y: number };
  getParentId: () => string;
}) => {
  const { actions, query } = useEditor();

  const [groups, setGroups] = useState<MergeFieldGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const controller = new AbortController();

    fetchMergeFields(controller.signal)
      .then((result) => {
        setGroups(result);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setErrorText(error instanceof Error ? error.message : 'Could not load merge fields.');
        setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const visibleGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return groups;

    return groups
      .map((group) => ({
        ...group,
        fields: group.fields.filter(
          (field) =>
            field.label.toLowerCase().includes(term) || field.token.toLowerCase().includes(term)
        ),
      }))
      .filter((group) => group.fields.length > 0);
  }, [groups, search]);

  const insertField = (token: string, label: string) => {
    const point = getInsertionPoint();
    const nodeTree = query
      .parseReactElement(
        <TextBlock html={`<p>{{${token}}}</p>`} fontSize={14} width={260} x={point.x} y={point.y} />
      )
      .toNodeTree();

    actions.addNodeTree(nodeTree, getParentId());
    toast({ title: `${label} added`, description: `Prints as {{${token}}}.` });
  };

  const copyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(`{{${token}}}`);
      toast({ title: 'Copied', description: `{{${token}}} is on the clipboard.` });
    } catch {
      toast({ title: 'Could not copy', description: 'Copy the token manually.', tone: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-slate-500">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading fields…
      </div>
    );
  }

  if (errorText) {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-700">
          {errorText}
        </div>
        <ToolButton
          onClick={() => {
            setErrorText('');
            setLoading(true);
            fetchMergeFields()
              .then((result) => {
                setGroups(result);
                setLoading(false);
              })
              .catch((error: unknown) => {
                setErrorText(
                  error instanceof Error ? error.message : 'Could not load merge fields.'
                );
                setLoading(false);
              });
          }}
        >
          Try again
        </ToolButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-slate-500">
        Click a field to place it on the page. It prints the real value for each student when the
        document is generated.
      </p>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search fields"
          className="h-9 w-full rounded-lg border border-slate-200 bg-white pr-2.5 pl-8 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      {visibleGroups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          No fields match “{search}”.
        </p>
      ) : (
        visibleGroups.map((group) => {
          // While searching, groups stay open so matches are never hidden.
          const isCollapsed = !search && collapsed[group.key];

          return (
            <div key={group.key} className="overflow-hidden rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() =>
                  setCollapsed((current) => ({ ...current, [group.key]: !current[group.key] }))
                }
                aria-expanded={!isCollapsed}
                className="flex w-full items-center justify-between bg-slate-50 px-3 py-2 text-left transition-colors hover:bg-slate-100"
              >
                <span className="text-[11px] font-semibold tracking-wide text-slate-600 uppercase">
                  {group.label}
                </span>
                <ChevronDown
                  className={`size-4 text-slate-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                />
              </button>

              {!isCollapsed && (
                <ul className="divide-y divide-slate-100">
                  {group.fields.map((field) => (
                    <li key={field.token}>
                      <div className="flex items-center justify-between gap-2 px-3 py-2 transition-colors hover:bg-blue-50/60">
                        <button
                          type="button"
                          onClick={() => insertField(field.token, field.label)}
                          className="min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                          title={`Insert ${field.label}`}
                        >
                          <span className="block truncate text-sm text-slate-700">{field.label}</span>
                          <span className="block truncate font-mono text-[11px] text-slate-400">
                            {`{{${field.token}}}`}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void copyToken(field.token)}
                          className="shrink-0 rounded-md px-1.5 py-1 text-[11px] text-slate-400 transition-colors hover:bg-white hover:text-[#0D6EFD]"
                          title="Copy token"
                        >
                          Copy
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};
