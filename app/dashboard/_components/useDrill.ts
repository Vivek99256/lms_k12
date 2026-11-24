'use client';

import { useCallback, useMemo } from 'react';
import { useShellMenu } from '@/app/components/shell-menu-context';
import { buildMenuSearchIndex, type MenuSearchEntry } from '@/app/data/menuSearch';

const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Turns "open the screen behind this number" into a click handler.
 *
 * `screens` are tblmenumaster names (case-insensitive, first match wins), looked up in the signed-in
 * user's own rights-filtered menu — so a figure only becomes clickable when the user can actually open
 * the screen, and it can never link somewhere the sidebar would not.
 */
export function useDrill() {
  const { menuItems, navigate } = useShellMenu();

  const index = useMemo(() => {
    const byLabel = new Map<string, MenuSearchEntry>();
    for (const entry of buildMenuSearchIndex(menuItems)) {
      if (entry.level === 1 || !entry.route) continue;
      const key = normalize(entry.label);
      if (!byLabel.has(key)) byLabel.set(key, entry);
    }
    return byLabel;
  }, [menuItems]);

  return useCallback(
    (screens: readonly string[] | undefined): (() => void) | undefined => {
      if (!screens) return undefined;
      const entry = screens.map((s) => index.get(normalize(s))).find(Boolean);
      return entry ? () => navigate(entry) : undefined;
    },
    [index, navigate],
  );
}
