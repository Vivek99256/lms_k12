'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getDashboardSession } from '@/app/dashboard/_lib/dashboard-api';
import {
  fetchDashboardPreferences,
  saveDashboardPreferences,
  type DashboardWidget,
  type DashboardWidgetGroup,
} from '@/app/dashboard/_lib/dashboard-preferences';

/**
 * The signed-in user's show/hide choices for one dashboard.
 *
 * `widgets` is the dashboard's full list of hideable widgets. For a static
 * list declare it `as const` at module level and `isVisible` only accepts
 * those ids (a typo is a type error). For a list built from API data, wrap it
 * in useMemo — its identity is a dependency here.
 *
 * Ids the server returns that are not in `widgets` right now (e.g. a
 * data-driven KPI the API didn't send this time) are ignored for display but
 * kept on save, so a user's choice survives a gap in the data.
 *
 * Spread `customizeProps` into <CustomizeDashboard widgets={...} />.
 */
export function useDashboardPreferences<W extends DashboardWidget>(dashboardKey: string, widgets: readonly W[]) {
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchDashboardPreferences(dashboardKey, getDashboardSession(), controller.signal)
      .then(setHiddenIds)
      // Fail open: if preferences can't be read, show the full dashboard
      // rather than blocking it. Saving surfaces its own error.
      .catch(() => undefined)
      .finally(() => {
        if (!controller.signal.aborted) setReady(true);
      });
    return () => controller.abort();
  }, [dashboardKey]);

  const hidden = useMemo(() => {
    const known = new Set(widgets.map((w) => w.id));
    return new Set(hiddenIds.filter((id) => known.has(id)));
  }, [hiddenIds, widgets]);

  const isVisible = useCallback((id: W['id']) => !hidden.has(id), [hidden]);

  const hasVisible = useCallback(
    (group?: DashboardWidgetGroup) => widgets.some((w) => (!group || w.group === group) && !hidden.has(w.id)),
    [hidden, widgets],
  );

  /** Persists the new hidden list; resolves false (with `saveError` set) if the server rejects it. */
  const save = useCallback(
    async (nextHidden: string[]) => {
      const known = new Set(widgets.map((w) => w.id));
      const keptUnknown = hiddenIds.filter((id) => !known.has(id));
      setSaving(true);
      setSaveError(null);
      try {
        setHiddenIds(await saveDashboardPreferences(dashboardKey, [...nextHidden, ...keptUnknown], getDashboardSession()));
        return true;
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Unable to save your dashboard layout.');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [dashboardKey, hiddenIds, widgets],
  );

  const clearSaveError = useCallback(() => setSaveError(null), []);

  const customizeProps = useMemo(
    () => ({ hidden, onSave: save, saving, error: saveError, onClearError: clearSaveError }),
    [hidden, save, saving, saveError, clearSaveError],
  );

  return { ready, hidden, isVisible, hasVisible, save, saving, saveError, clearSaveError, customizeProps };
}
