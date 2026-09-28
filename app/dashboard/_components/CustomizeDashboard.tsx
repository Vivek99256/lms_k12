'use client';

import React, { useState } from 'react';
import { Loader2, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { EmptyState } from '@/app/dashboard/_components/DashboardPrimitives';
import type { DashboardWidget, DashboardWidgetGroup } from '@/app/dashboard/_lib/dashboard-preferences';

const GROUPS: Array<{ group: DashboardWidgetGroup; label: string }> = [
  { group: 'kpi', label: 'KPI cards' },
  { group: 'chart', label: 'Charts' },
  { group: 'panel', label: 'Other sections' },
];

/** Shown in place of a dashboard's content when the user has hidden every widget on it. */
export function AllWidgetsHiddenNotice() {
  return <EmptyState message="You've hidden everything on this dashboard. Use Customize to bring cards and charts back." />;
}

/**
 * "Customize" button + side sheet listing every widget on a dashboard with a
 * show/hide switch. Edits a local draft; nothing changes on the dashboard
 * until "Save changes", and the saved choice belongs to the signed-in user
 * only (see useDashboardPreferences). Renders nothing while `widgets` is
 * empty (e.g. a data-driven list that hasn't loaded yet).
 *
 * Usage: <CustomizeDashboard widgets={WIDGETS} {...prefs.customizeProps} />
 */
export function CustomizeDashboard({
  widgets,
  hidden,
  onSave,
  saving,
  error,
  onClearError,
  size = 'default',
  className,
}: {
  widgets: readonly DashboardWidget[];
  hidden: ReadonlySet<string>;
  onSave: (hiddenIds: string[]) => Promise<boolean>;
  saving: boolean;
  error: string | null;
  onClearError: () => void;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Set<string>>(() => new Set());

  const openSheet = () => {
    setDraft(new Set(hidden));
    onClearError();
    setOpen(true);
  };

  const toggle = (id: string) => {
    setDraft((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const dirty = draft.size !== hidden.size || [...draft].some((id) => !hidden.has(id));

  const handleSave = async () => {
    // Keep the registry order so the stored list is stable across saves.
    const ok = await onSave(widgets.filter((w) => draft.has(w.id)).map((w) => w.id));
    if (ok) setOpen(false);
  };

  if (widgets.length === 0) return null;

  return (
    <>
      <Button variant="outline" size={size} className={className} onClick={openSheet}>
        <SlidersHorizontal />
        Customize
      </Button>

      <Sheet open={open} onOpenChange={(next) => !saving && setOpen(next)}>
        <SheetContent side="right" className="flex flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Customize your dashboard</SheetTitle>
            <SheetDescription>
              Choose which cards and charts you see. This only changes your dashboard — other users are not affected.
            </SheetDescription>
          </SheetHeader>

          <div className="-mx-6 flex-1 space-y-6 overflow-y-auto px-6">
            {GROUPS.map(({ group, label }) => {
              const items = widgets.filter((w) => w.group === group);
              if (items.length === 0) return null;
              const shown = items.filter((w) => !draft.has(w.id)).length;
              return (
                <section key={group}>
                  <div className="mb-1 flex items-baseline justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</h3>
                    <span className="text-xs text-slate-400">
                      {shown} of {items.length} shown
                    </span>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {items.map((w) => (
                      <li key={w.id}>
                        <label className="flex cursor-pointer items-center justify-between gap-4 py-2.5 text-sm text-slate-700">
                          <span>{w.label}</span>
                          <Switch size="sm" checked={!draft.has(w.id)} onChange={() => toggle(w.id)} disabled={saving} />
                        </label>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>

          {error && (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <SheetFooter className="mt-0 sm:justify-between">
            <Button variant="ghost" onClick={() => setDraft(new Set())} disabled={saving || draft.size === 0}>
              Show all
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || !dirty}>
                {saving && <Loader2 className="animate-spin" />}
                Save changes
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
