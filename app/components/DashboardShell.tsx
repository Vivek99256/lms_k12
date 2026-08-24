<<<<<<< HEAD
﻿'use client';
=======
'use client';
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d

import React, { createContext, useMemo, useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from '@/app/components/Sidebar';
import Header from '@/app/components/Header';
import ChatbotPanel from '@/app/components/ChatbotPanel';
import RightFloatingToolbar from '@/app/components/RightFloatingToolbar';
import Level3Subheader from '@/app/components/Level3Subheader';
import { type Level3Item, type MenuItem, type SubmenuItem } from '@/app/data/menuItems';
import { useMenuRights, getStoredMenuContext } from '@/app/hooks/useMenuRights';
<<<<<<< HEAD
import { usePathname, useRouter } from 'next/navigation';
import { mapApiLinkToRoute } from '@/app/data/routeMapper';
=======
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { mapApiLinkToRoute } from '@/app/data/routeMapper';
import { resolveModuleDashboardRoute } from '@/app/data/moduleDashboards';
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
import { API_BASE_URL } from '@/app/components/utils/api_url';

interface SelectedBranch {
  level1Key: string;
  level2Key: string;
}

export const ChatbotLayoutContext = createContext<{ isChatbotOpen: boolean }>({
  isChatbotOpen: false,
});

function getMenuKey(item: { id?: number | string; label: string; href?: string }) {
  return String(item.id ?? item.href ?? item.label);
}

const FEES_SETUP_MASTER_LABELS = [
  'Fees Config Master',
  'Fees Late Master',
  'Fees Receipt Book Master',
  'New Fees Title',
  'Fees BreakOff',
  'Update Fees BreakOff',
  'Additional Fees Mapping',
  'Bank Master',
  'Other Fees Title',
  'Fees Circular Master',
  'Fees Month Header',
];

const FEES_SETUP_MASTER_LABEL_ORDER = new Map(
  FEES_SETUP_MASTER_LABELS.map((label, index) => [normalizeMenuLabel(label), index])
);

function normalizeMenuLabel(label: string) {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}

function getFilteredMasterMenuItems(items: SubmenuItem[], selectedMenu: SubmenuItem) {
  if (normalizeMenuLabel(selectedMenu.label) !== 'fees setup') return items;

  return items
    .filter((item) => FEES_SETUP_MASTER_LABEL_ORDER.has(normalizeMenuLabel(item.label)))
    .sort((a, b) => {
      const aIndex = FEES_SETUP_MASTER_LABEL_ORDER.get(normalizeMenuLabel(a.label)) ?? Number.MAX_SAFE_INTEGER;
      const bIndex = FEES_SETUP_MASTER_LABEL_ORDER.get(normalizeMenuLabel(b.label)) ?? Number.MAX_SAFE_INTEGER;
      return aIndex - bIndex;
    });
}

<<<<<<< HEAD
export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const router = useRouter();
=======
/**
 * New PAL's sub-modules — the level-3 bar shown under LMS + PAL → New PAL.
 *
 * Three of these live at `/pal/*` paths rather than under `/pal/new/*` for
 * historical reasons; they are New PAL sub-modules all the same, which is why
 * the route family below is derived from these hrefs rather than assumed from
 * a `/pal` prefix.
 */
const NEW_PAL_LEVEL3_ITEMS: Level3Item[] = [
  {
    id: 'pal-framework',
    label: 'Framework',
    href: '/pal/frameworks',
  },
  {
    id: 'pal-content-model',
    label: 'Content Model',
    href: '/pal/new/content-model',
  },
  {
    id: 'pal-ulu',
    label: 'Unified Learning Units',
    href: '/pal/ulu',
  },
  {
    id: 'pal-pedagogy-engine',
    label: 'Pedagogy Engine',
    href: '/pal/pedagogy-engine',
  },
  {
    id: 'pal-administration',
    label: 'Administration',
    href: '/pal/new/administration',
  },
  {
    id: 'pal-gamification',
    label: 'Gamification',
    href: '/pal/new/gamification',
  },
];

/** `href` itself, or a page nested under it — never a sibling that merely shares a prefix. */
function isUnderRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The New PAL sub-nav, or null when this route is not part of New PAL.
 *
 * Scoped to the New PAL workspace and the sub-modules it links to. A `/pal`
 * prefix is NOT enough: LMS + PAL → Test → PAL is the legacy PAL workspace at
 * `/pal`, and Content/Exam/Report/Result/Intelligence hang off it. Those are a
 * different module and must not wear New PAL's navigation.
 *
 * The boundary check matters here — `/pal/framework` (legacy) and
 * `/pal/frameworks` (New PAL) differ by one character, so a plain
 * `startsWith` would drag the legacy page back in.
 */
function newPalLevel3Items(pathname: string): Level3Item[] | null {
  const lowerPath = pathname.toLowerCase().replace(/\/+$/, '') || '/';

  const inNewPal =
    isUnderRoute(lowerPath, '/pal/new') ||
    NEW_PAL_LEVEL3_ITEMS.some((item) => isUnderRoute(lowerPath, item.href));

  return inNewPal ? NEW_PAL_LEVEL3_ITEMS : null;
}


export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const router = useRouter();
  const searchParams = useSearchParams();
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
  const { menuItems, loading, error, refetch } = useMenuRights();
  const hasLoadedRef = useRef(false);

  const [selectedBranch, setSelectedBranch] = useState<SelectedBranch | null>(null);
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [isRightToolbarOpen, setIsRightToolbarOpen] = useState(false);
  const rightToolbarToggleRef = useRef<HTMLButtonElement>(null);

  const [userProfileName, setUserProfileName] = useState('');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUserProfileName((prev) => {
      const ctx = getStoredMenuContext();
      return ctx?.user_profile_name ? ctx.user_profile_name.toString().trim() : prev;
    });
  }, []);

  const [fetchedMasterMenuItems, setFetchedMasterMenuItems] = useState<SubmenuItem[]>([]);
  const [masterMenuGroups, setMasterMenuGroups] = useState<Record<string, unknown>[]>([]);
  const [masterMenuLoading, setMasterMenuLoading] = useState(false);
  const [masterMenuFetchedFor, setMasterMenuFetchedFor] = useState<string | null>(null);

  const isKnownMenuPath = useCallback((checkPath: string): boolean => {
    const lower = (checkPath || '').toLowerCase();
    if (!lower || lower === '/dashboard' || lower === '/') return true;

    for (const item of menuItems) {
      // Check link field first (from API), then fallback to href
      const itemRoute = item.link ? mapApiLinkToRoute(item.link) : item.href;
      if (itemRoute && itemRoute !== '#' && lower.startsWith(itemRoute.toLowerCase())) return true;
      if (item.submenus) {
        for (const submenu of item.submenus) {
          const submenuRoute = submenu.link ? mapApiLinkToRoute(submenu.link) : submenu.href;
          if (submenuRoute && submenuRoute !== '#' && lower.startsWith(submenuRoute.toLowerCase())) return true;
          if (submenu.submenus) {
            for (const l3 of submenu.submenus) {
              const l3Route = l3.link ? mapApiLinkToRoute(l3.link) : l3.href;
              if (l3Route && l3Route !== '#' && lower.startsWith(l3Route.toLowerCase())) return true;
            }
          }
        }
      }
    }
    return false;
  }, [menuItems]);

  useEffect(() => {
    if (!menuItems.length || selectedBranch) return;

    const currentPath = pathname.toLowerCase();
    for (const level1 of menuItems) {
      for (const level2 of level1.submenus ?? []) {
        const level2Route = level2.link ? mapApiLinkToRoute(level2.link) : level2.href;
        const level3Match = level2.submenus?.some((level3) => {
          const route = level3.link ? mapApiLinkToRoute(level3.link) : level3.href;
          return route !== '#' && currentPath === route.toLowerCase();
        });
        const level2Match = level2Route !== '#' && currentPath.startsWith(level2Route.toLowerCase());
<<<<<<< HEAD

        if (level2Match || level3Match) {
=======
        const dashboardRoute = resolveModuleDashboardRoute(level2.label);
        const dashboardMatch = Boolean(dashboardRoute && currentPath.startsWith(dashboardRoute.toLowerCase()));

        if (level2Match || level3Match || dashboardMatch) {
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
          // Restore the active menu branch on refresh/direct navigation so its
          // permission-filtered Master menu can be fetched for the sub-header.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setSelectedBranch({
            level1Key: getMenuKey(level1),
            level2Key: getMenuKey(level2),
          });
          return;
        }
      }
    }
  }, [menuItems, pathname, selectedBranch]);

   const fetchMasterMenu = useCallback(async (mainMenuId: number | string | undefined, menuItem: SubmenuItem | undefined) => {
    if (!mainMenuId || !menuItem) return;

    const cacheKey = `${mainMenuId}-${menuItem.id}`;
    if (masterMenuFetchedFor === cacheKey) return;

    const session = getStoredMenuContext();
    if (!session) return;

    setMasterMenuLoading(true);
    try {
      const url = new URL(`${API_BASE_URL.replace(/\/$/, '')}/api/master-menu-rights`);
      url.searchParams.set('menu_id', String(menuItem.id));
      url.searchParams.set('main_menu_id', String(mainMenuId));
      url.searchParams.set('type', 'API');
      url.searchParams.set('sub_institute_id', String(session.sub_institute_id));
      url.searchParams.set('user_id', String(session.user_id));

      const res = await fetch(url.toString());
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to fetch master menu rights');

      const rawData = Array.isArray(data.data) ? data.data : [];
      let mapped: SubmenuItem[] = [];

      if (rawData.length > 0 && (rawData[0] as Record<string, unknown>).url) {
        setMasterMenuGroups([]);
        mapped = rawData.map((item: Record<string, unknown>, index: number) => ({
          id: (item.id ?? item.tblmenu_master_id ?? index) as number | string | undefined,
          parentId: (item.parent_menu_id ?? item.parentId) as number | string | undefined,
          menuType: (item.menu_type ?? item.menuType) as string | undefined,
          label: String(item.name ?? item.label ?? ''),
          href: String(item.route_name ?? item.href ?? '#'),
          icon: undefined,
          submenus: undefined,
        }));
      } else {
        setMasterMenuGroups(rawData);
        const children: Record<string, unknown>[] = [];
        for (const group of rawData) {
          const groupChildren = (group as Record<string, unknown>).children;
          if (Array.isArray(groupChildren)) {
            children.push(...groupChildren);
          }
        }

        mapped = children.map((item: Record<string, unknown>, index: number) => ({
          id: (item.id ?? item.tblmenu_master_id ?? index) as number | string | undefined,
          parentId: (item.parent_menu_id ?? item.parentId) as number | string | undefined,
          menuType: (item.menu_type ?? item.menuType) as string | undefined,
          label: String(item.name ?? item.label ?? ''),
          href: String(item.route_name ?? item.href ?? '#'),
          icon: undefined,
          submenus: undefined,
        }));
      }

      const filtered = getFilteredMasterMenuItems(mapped, menuItem);
      setFetchedMasterMenuItems(filtered);
      setMasterMenuGroups(rawData.length > 0 && (rawData[0] as Record<string, unknown>).url ? [] : rawData);
      setMasterMenuFetchedFor(cacheKey);
    } catch (error) {
      console.error('Master menu request failed:', error);
      setFetchedMasterMenuItems([]);
      setMasterMenuGroups([]);
    } finally {
      setMasterMenuLoading(false);
    }
  }, [masterMenuFetchedFor]);

  useEffect(() => {
    if (!hasLoadedRef.current && selectedBranch && menuItems.length > 1) {
      const selectedLevel1 = menuItems.find((item) => getMenuKey(item) === selectedBranch.level1Key);
      const selectedLevel2 = selectedLevel1?.submenus?.find((submenu) => getMenuKey(submenu) === selectedBranch.level2Key);
      if (!selectedLevel2?.submenus?.length) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedBranch(null);
        return;
      }

<<<<<<< HEAD
=======
      const selectedLevel2Route = selectedLevel2.link ? mapApiLinkToRoute(selectedLevel2.link) : selectedLevel2.href;
      const isPalRoot = normalizeMenuLabel(selectedLevel2.label) === 'new pal' || (selectedLevel2Route || '').toLowerCase() === '/pal';
      if (isPalRoot) {
        return;
      }

>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
      if (!isKnownMenuPath(pathname)) {
        return;
      }

      // If Level 2 has Level 3 items, navigate to the first one if current path doesn't match any Level 3
      if (selectedLevel2?.submenus?.length) {
        const currentPath = pathname.toLowerCase();
        const hasMatchingLevel3 = selectedLevel2.submenus.some((l3) => {
          // Check both link (from API) and href fields
          const linkRoute = l3.link ? mapApiLinkToRoute(l3.link) : null;
          const hrefRoute = l3.href && l3.href !== '#' ? l3.href : null;
          const targetRoute = linkRoute && linkRoute !== '#' ? linkRoute : hrefRoute;
          return targetRoute && currentPath === targetRoute.toLowerCase();
        });

        if (!hasMatchingLevel3) {
          const firstLevel3 = selectedLevel2.submenus[0];
          // Use 'link' field from API first, fallback to href
          const navigateRoute = firstLevel3.link ? mapApiLinkToRoute(firstLevel3.link) : firstLevel3.href;
          if (navigateRoute && navigateRoute !== '#') {
            router.push(navigateRoute);
          }
        }
      }
    }
    if (menuItems.length > 0) {
      hasLoadedRef.current = true;
    }
  }, [menuItems, selectedBranch, pathname, router, isKnownMenuPath]);

  const toggleChatbot = () => {
    setIsChatbotOpen((prev) => {
      const next = !prev;
      setIsRightToolbarOpen(!next);
      return next;
    });
  };

  const toggleRightToolbar = () => {
    if (isChatbotOpen) return;
    setIsRightToolbarOpen((prev) => !prev);
  };

  const handleLevel1Select = (item: MenuItem) => {
    setSelectedBranch((current) => {
      const key = getMenuKey(item);
      return current?.level1Key === key ? { level1Key: key, level2Key: '' } : { level1Key: key, level2Key: '' };
    });
  };

  const handleLevel2Select = async (submenu: SubmenuItem, parent: MenuItem) => {
    setSelectedBranch({
      level1Key: getMenuKey(parent),
      level2Key: getMenuKey(submenu),
    });
    setMasterMenuFetchedFor(null);

    await fetchMasterMenu(parent.id, submenu);

<<<<<<< HEAD
=======
    const submenuRoute = submenu.link ? mapApiLinkToRoute(submenu.link) : submenu.href;
    const isPalRoot = normalizeMenuLabel(submenu.label) === 'new pal' || (submenuRoute || '').toLowerCase() === '/pal';
    if (isPalRoot) {
      const query = searchParams?.toString() ?? '';
      router.push(query ? `/pal/frameworks?${query}` : '/pal/frameworks');
      return;
    }

    // Modules with their own dashboard (Fees, Admissions, Students, Library,
    // Hostel, Transportation) land there — Level 2 → module dashboard →
    // Level 3 screen — instead of jumping straight into the first Level 3
    // screen. selectedBranch is already set above, so the Level 3 subheader
    // still shows this module's screens for the next click.
    const dashboardRoute = resolveModuleDashboardRoute(submenu.label);
    if (dashboardRoute) {
      router.push(dashboardRoute);
      return;
    }

>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
    if (submenu.submenus && submenu.submenus.length > 0) {
      const firstLevel3 = submenu.submenus[0];
      // Use 'link' field from API (priority) or 'href' field
      const navigateRoute = firstLevel3.link ? mapApiLinkToRoute(firstLevel3.link) : firstLevel3.href;
      if (navigateRoute && navigateRoute !== '#') {
        router.push(navigateRoute);
      }
    }
  };

  const selectedL1 = useMemo(() => {
    if (!selectedBranch?.level1Key) return null;
    return menuItems.find((item) => getMenuKey(item) === selectedBranch.level1Key) ?? null;
  }, [menuItems, selectedBranch]);

  useEffect(() => {
    if (!selectedBranch?.level2Key || !selectedL1 || masterMenuFetchedFor) return;

      const selectedLevel2 = selectedL1.submenus?.find((submenu) => getMenuKey(submenu) === selectedBranch.level2Key);
      if (selectedLevel2) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchMasterMenu(selectedL1.id, selectedLevel2);
      }
  }, [selectedBranch, selectedL1, masterMenuFetchedFor, fetchMasterMenu]);

  const selectedL2 = useMemo(() => {
    if (!selectedBranch || !selectedL1 || !selectedBranch.level2Key) return null;
    return selectedL1.submenus?.find((submenu) => getMenuKey(submenu) === selectedBranch.level2Key) ?? null;
  }, [selectedBranch, selectedL1]);

  const searchLevel3FromMenu = (items: MenuItem[], path: string): { parentLabel: string; items: Level3Item[] } | null => {
    if (!path || !items.length) return null;
    for (const item of items) {
      if (item.submenus && item.href && !item.href.startsWith('#')) {
        for (const submenu of item.submenus) {
          // Check both link (from API) and href fields
          const linkRoute = submenu.link ? mapApiLinkToRoute(submenu.link) : null;
          const submenuRoute = (linkRoute && linkRoute !== '#') ? linkRoute : submenu.href;
          const submenuHref = (submenuRoute || '').toLowerCase();
          if (submenu.submenus?.length && submenuHref !== '#' && path.startsWith(submenuHref)) {
            return { parentLabel: submenu.label, items: submenu.submenus as Level3Item[] };
          }
        }
      }
    }
    return null;
  };

  const level3Menu = (() => {
<<<<<<< HEAD
=======
    // New PAL brings its own sub-nav. Every other route — including the legacy
    // PAL workspace under LMS + PAL → Test → PAL — falls through to the normal
    // menu-driven resolution below and gets whatever its own menu defines.
    const newPalItems = newPalLevel3Items(pathname);
    if (newPalItems) {
      return { parentLabel: 'New PAL', items: newPalItems };
    }
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
    if (selectedL2?.submenus?.length) {
      return { parentLabel: selectedL2.label, items: selectedL2.submenus as Level3Item[] };
    }
    const found = searchLevel3FromMenu(menuItems, pathname);
<<<<<<< HEAD
=======
    if (!found) return null;
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
    return found;
  })();

  const showSubheader = Boolean(level3Menu?.items.length || fetchedMasterMenuItems.length > 0 || masterMenuGroups.length > 0);

  return (
    <div className="app-shell-background flex h-screen overflow-hidden">
      <Sidebar
        menuItems={menuItems}
        loading={loading}
        error={error}
        refetch={refetch}
        onLevel1Select={handleLevel1Select}
        onLevel2Select={handleLevel2Select}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden px-4 pb-4 pt-3">
        <Header
          onToggleChatbot={toggleChatbot}
          isChatbotOpen={isChatbotOpen}
<<<<<<< HEAD
          onToggleRightToolbar={toggleRightToolbar}
          isRightToolbarOpen={isRightToolbarOpen}
          rightToolbarToggleRef={rightToolbarToggleRef}
=======
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
        />
        <div className="mt-4 flex min-h-0 flex-1 gap-4 overflow-hidden">
          <main
            className={`min-w-0 flex-1 overflow-auto scrollbar-hide transition-[width] duration-300 ease-out ${
              isChatbotOpen ? 'w-[85%]' : 'w-full'
            }`}
          >
            <ChatbotLayoutContext.Provider value={{ isChatbotOpen }}>
              {showSubheader && (
                <div className="pb-4">
                  <Level3Subheader
                    items={level3Menu?.items ?? []}
                    parentLabel={level3Menu?.parentLabel ?? ''}
                    mainMenuId={selectedL1?.id}
                    menuId={selectedL2?.id}
                    masterItems={fetchedMasterMenuItems}
                    masterLoading={masterMenuLoading}
                    masterMenuGroups={masterMenuGroups}
                    userProfileName={userProfileName}
                  />
                </div>
              )}
              {children}
            </ChatbotLayoutContext.Provider>
          </main>
          {isChatbotOpen && (
            <div className="min-h-0 w-[15%] min-w-[320px] overflow-hidden">
              <ChatbotPanel onToggleChatbot={toggleChatbot} />
            </div>
          )}
        </div>
        <RightFloatingToolbar
          isChatbotOpen={isChatbotOpen}
          isOpen={isRightToolbarOpen}
          onOpenChange={setIsRightToolbarOpen}
          toggleButtonRef={rightToolbarToggleRef}
        />
      </div>
    </div>
  );
}
<<<<<<< HEAD
=======







>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
