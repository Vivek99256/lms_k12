'use client';

import { createContext, useContext } from 'react';
import type { MenuItem } from '@/app/data/menuItems';
import type { MenuSearchEntry } from '@/app/data/menuSearch';

/**
 * The shell's rights-filtered menu tree, shared with the page it wraps.
 *
 * DashboardShell already fetches the menu once (useMenuRights); a page that
 * needs to know "which screens can this user open?" — the dashboard's quick
 * actions — reads it from here instead of fetching it a second time.
 * `navigate` is the same handler the header search uses, so a page link opens
 * its screen with the module's level-3 bar selected, exactly as a search would.
 *
 * Outside the shell (full-bleed routes) the default is an empty, loaded menu,
 * so consumers render nothing rather than waiting forever.
 */
export type ShellMenuState = {
  menuItems: MenuItem[];
  loading: boolean;
  navigate: (entry: MenuSearchEntry) => void | Promise<void>;
};

export const ShellMenuContext = createContext<ShellMenuState>({
  menuItems: [],
  loading: false,
  navigate: () => undefined,
});

export function useShellMenu() {
  return useContext(ShellMenuContext);
}
