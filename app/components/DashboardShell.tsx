'use client';

import React, { createContext, useMemo, useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from '@/app/components/Sidebar';
import Header from '@/app/components/Header';
import ChatbotPanel from '@/app/components/ChatbotPanel';
import { PageAiContextProvider } from '@/contexts/PageAiContext';
import RightFloatingToolbar from '@/app/components/RightFloatingToolbar';
import Level3Subheader from '@/app/components/Level3Subheader';
import { type Level3Item, type MenuItem, type SubmenuItem } from '@/app/data/menuItems';
import { useMenuRights, getStoredMenuContext } from '@/app/hooks/useMenuRights';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { mapApiLinkToRoute } from '@/app/data/routeMapper';
import { resolveModuleDashboardRoute } from '@/app/data/moduleDashboards';
import { API_BASE_URL } from '@/app/components/utils/api_url';
import { BrainCircuit } from 'lucide-react';
import { BRAIN_MENU_LABEL, BRAIN_ROOT, BRAIN_SECTIONS } from '@/lib/brain/navigation';
import { BRAIN_API_BASE_URL } from '@/lib/brain/api';
import { useFeesLevel3Nav } from '@/app/fees/_lib/use-fees-level3-nav';

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

function isBrainVisibleByLmsSession() {
  if (typeof window === 'undefined') return false;

  try {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const menuContext = JSON.parse(localStorage.getItem('menuContext') || '{}');
    const isAdmin = Number(userData.is_admin ?? menuContext.is_admin ?? 0);
    const profileName = String(menuContext.user_profile_name ?? userData.user_profile ?? '').toLowerCase();
    const profileId = Number(menuContext.user_profile_id ?? userData.user_profile_id ?? 0);
    const hasTenant = (userData.sub_institute_id != null && userData.sub_institute_id !== '') || (menuContext.sub_institute_id != null && menuContext.sub_institute_id !== '');
    const hasUser = (userData.id != null && userData.id !== '') || (menuContext.user_id != null && menuContext.user_id !== '');

    return hasTenant && hasUser && (
      isAdmin === 1 ||
      isAdmin === 2 ||
      profileId === 1 ||
      profileName.includes('admin') ||
      profileName.includes('principal') ||
      profileName.includes('management')
    );
  } catch {
    return false;
  }
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
 * The "New PAL" level-2 menu node from the rights-filtered menu tree, or
 * undefined if the current role has no access to it at all. New PAL sits at
 * level 2 (under "LMS + PAL"), so this only needs to check one level down —
 * no need for general-purpose recursion.
 */
function findNewPalMenuNode(items: MenuItem[]): SubmenuItem | undefined {
  for (const level1 of items) {
    const match = level1.submenus?.find((level2) => normalizeMenuLabel(level2.label) === 'new pal');
    if (match) return match;
  }
  return undefined;
}

/**
 * The New PAL sub-nav, or null when this route is not part of New PAL, or
 * when the current role has no `can_view` rights on any of its sub-modules.
 *
 * Scoped to the New PAL workspace and the sub-modules it links to. A `/pal`
 * prefix is NOT enough: LMS + PAL → Test → PAL is the legacy PAL workspace at
 * `/pal`, and Content/Exam/Report/Result/Intelligence hang off it. Those are a
 * different module and must not wear New PAL's navigation.
 *
 * The boundary check matters here — `/pal/framework` (legacy) and
 * `/pal/frameworks` (New PAL) differ by one character, so a plain
 * `startsWith` would drag the legacy page back in.
 *
 * NEW_PAL_LEVEL3_ITEMS supplies the display metadata (label, href, order);
 * this only decides which of those items the caller's role is allowed to
 * see, by cross-referencing the menu-rights API's "New PAL" node — the same
 * data source Access Roles writes to and every other module's level-3 bar
 * reads from.
 */
function newPalLevel3Items(pathname: string, menuItems: MenuItem[]): Level3Item[] | null {
  const lowerPath = pathname.toLowerCase().replace(/\/+$/, '') || '/';

  const inNewPal =
    isUnderRoute(lowerPath, '/pal/new') ||
    NEW_PAL_LEVEL3_ITEMS.some((item) => isUnderRoute(lowerPath, item.href));

  if (!inNewPal) return null;

  const newPalNode = findNewPalMenuNode(menuItems);
  const allowedLabels = new Set((newPalNode?.submenus ?? []).map((submenu) => normalizeMenuLabel(submenu.label)));

  const items = NEW_PAL_LEVEL3_ITEMS.filter((item) => allowedLabels.has(normalizeMenuLabel(item.label)));
  return items.length ? items : null;
}


export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const router = useRouter();
  const searchParams = useSearchParams();
  const { menuItems, loading, error, refetch } = useMenuRights();
  const hasLoadedRef = useRef(false);

  const [selectedBranch, setSelectedBranch] = useState<SelectedBranch | null>(null);
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [isRightToolbarOpen, setIsRightToolbarOpen] = useState(false);
  const rightToolbarToggleRef = useRef<HTMLButtonElement>(null);

  const [userProfileName, setUserProfileName] = useState('');
  const [hasBrainAccess, setHasBrainAccess] = useState(() => isBrainVisibleByLmsSession());

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUserProfileName((prev) => {
      const ctx = getStoredMenuContext();
      return ctx?.user_profile_name ? ctx.user_profile_name.toString().trim() : prev;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkBrainAccess() {
      if (typeof window === 'undefined') return;
      try {
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        const token = String(userData.user_token || userData.token || '');
        if (!token) {
          setHasBrainAccess(isBrainVisibleByLmsSession());
          return;
        }

        const res = await fetch(`${BRAIN_API_BASE_URL}/api/brain/access`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json().catch(() => ({}));
        if (!cancelled) {
          setHasBrainAccess(Boolean(res.ok && data?.allowed) || isBrainVisibleByLmsSession());
        }
      } catch {
        if (!cancelled) setHasBrainAccess(isBrainVisibleByLmsSession());
      }
    }

    checkBrainAccess();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayedMenuItems = useMemo<MenuItem[]>(() => {
    if (!hasBrainAccess) return menuItems;
    const alreadyPresent = menuItems.some((item) => normalizeMenuLabel(item.label) === 'enterprise brain');
    if (alreadyPresent) return menuItems;

    // Built as an ordinary three-level MenuItem so the existing Sidebar flyout
    // and Level3Subheader drive it: Level 1 Enterprise Brain -> Level 2 section
    // -> Level 3 screen. No Brain-specific navigation component exists.
    return [
      ...menuItems,
      {
        id: 'enterprise-brain',
        icon: BrainCircuit,
        label: BRAIN_MENU_LABEL,
        href: BRAIN_ROOT,
        submenus: BRAIN_SECTIONS.map((section) => ({
          id: `enterprise-brain-${section.key}`,
          parentId: 'enterprise-brain',
          label: section.label,
          href: section.href,
          icon: section.icon,
          submenus: section.screens.map((screen) => ({
            id: `enterprise-brain-${section.key}-${screen.key}`,
            parentId: `enterprise-brain-${section.key}`,
            label: screen.label,
            href: screen.href,
          })),
        })),
      },
    ];
  }, [hasBrainAccess, menuItems]);

  const [fetchedMasterMenuItems, setFetchedMasterMenuItems] = useState<SubmenuItem[]>([]);
  const [masterMenuGroups, setMasterMenuGroups] = useState<Record<string, unknown>[]>([]);
  const [masterMenuLoading, setMasterMenuLoading] = useState(false);
  const [masterMenuFetchedFor, setMasterMenuFetchedFor] = useState<string | null>(null);

  const isKnownMenuPath = useCallback((checkPath: string): boolean => {
    const lower = (checkPath || '').toLowerCase();
    if (!lower || lower === '/dashboard' || lower === '/') return true;

    for (const item of displayedMenuItems) {
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
  }, [displayedMenuItems]);

  useEffect(() => {
    if (!displayedMenuItems.length || selectedBranch) return;

    const currentPath = pathname.toLowerCase();
    // Most specific branch wins. Enterprise Brain's Overview section is routed
    // at /enterprise-brain, a prefix of every other Brain route, so a
    // first-match scan would select Overview for all of them.
    let match: SelectedBranch | null = null;
    let matchLength = -1;

    for (const level1 of displayedMenuItems) {
      for (const level2 of level1.submenus ?? []) {
        const level2Route = level2.link ? mapApiLinkToRoute(level2.link) : level2.href;
        const level3Route = level2.submenus
          ?.map((level3) => (level3.link ? mapApiLinkToRoute(level3.link) : level3.href))
          .find((route) => route !== '#' && currentPath === route.toLowerCase());
        const level2Match = level2Route !== '#' && currentPath.startsWith(level2Route.toLowerCase());
        const dashboardRoute = resolveModuleDashboardRoute(level2.label);
        const dashboardMatch = Boolean(dashboardRoute && currentPath.startsWith(dashboardRoute.toLowerCase()));

        if (!level2Match && !level3Route && !dashboardMatch) continue;

        const length = level3Route ? level3Route.length : level2Match ? level2Route.length : (dashboardRoute?.length ?? 0);
        if (length <= matchLength) continue;

        match = { level1Key: getMenuKey(level1), level2Key: getMenuKey(level2) };
        matchLength = length;
      }
    }

    if (match) {
      // Restore the active menu branch on refresh/direct navigation so its
      // permission-filtered Master menu can be fetched for the sub-header.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedBranch(match);
    }
  }, [displayedMenuItems, pathname, selectedBranch]);

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
    if (!hasLoadedRef.current && selectedBranch && displayedMenuItems.length > 1) {
      const selectedLevel1 = displayedMenuItems.find((item) => getMenuKey(item) === selectedBranch.level1Key);
      const selectedLevel2 = selectedLevel1?.submenus?.find((submenu) => getMenuKey(submenu) === selectedBranch.level2Key);
      if (!selectedLevel2?.submenus?.length) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedBranch(null);
        return;
      }

      const selectedLevel2Route = selectedLevel2.link ? mapApiLinkToRoute(selectedLevel2.link) : selectedLevel2.href;
      const isPalRoot = normalizeMenuLabel(selectedLevel2.label) === 'new pal' || (selectedLevel2Route || '').toLowerCase() === '/pal';
      if (isPalRoot) {
        return;
      }

      if (!isKnownMenuPath(pathname)) {
        return;
      }

      // Every Enterprise Brain route resolves to a real page, including the
      // section landing pages and /capabilities/[id]. The "land on the first
      // Level 3" redirect below exists for modules whose Level 2 has no screen
      // of its own, and applying it here would bounce a deep link back to the
      // first sibling.
      if (pathname.toLowerCase().startsWith(BRAIN_ROOT)) {
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
    if (displayedMenuItems.length > 0) {
      hasLoadedRef.current = true;
    }
  }, [displayedMenuItems, selectedBranch, pathname, router, isKnownMenuPath]);

  const toggleChatbot = () => {
    setIsChatbotOpen((prev) => {
      const next = !prev;
      setIsRightToolbarOpen(!next);
      return next;
    });
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

    // Each Enterprise Brain section has a landing page of its own listing its
    // screens with live counts, so a section click lands there rather than
    // jumping past it into the first screen. It also has no LMS master menu.
    if (String(parent.id ?? '') === 'enterprise-brain') {
      if (submenu.href && submenu.href !== '#') router.push(submenu.href);
      return;
    }

    await fetchMasterMenu(parent.id, submenu);

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
    return displayedMenuItems.find((item) => getMenuKey(item) === selectedBranch.level1Key) ?? null;
  }, [displayedMenuItems, selectedBranch]);

  useEffect(() => {
    if (!selectedBranch?.level2Key || !selectedL1 || masterMenuFetchedFor) return;
    // Enterprise Brain screens are not backed by the LMS master-menu rights
    // table, so asking for their master menu only produces a failed request.
    if (String(selectedL1.id ?? '') === 'enterprise-brain') return;

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

  const feesLevel3Menu = useFeesLevel3Nav({
    selectedLevel2Label: selectedL2?.label,
    pathname,
  });

  const searchLevel3FromMenu = (items: MenuItem[], path: string): { parentLabel: string; items: Level3Item[] } | null => {
    if (!path || !items.length) return null;

    let best: { parentLabel: string; items: Level3Item[] } | null = null;
    let bestLength = -1;

    for (const item of items) {
      if (!item.submenus || !item.href || item.href.startsWith('#')) continue;
      for (const submenu of item.submenus) {
        // Check both link (from API) and href fields
        const linkRoute = submenu.link ? mapApiLinkToRoute(submenu.link) : null;
        const submenuRoute = (linkRoute && linkRoute !== '#') ? linkRoute : submenu.href;
        const submenuHref = (submenuRoute || '').toLowerCase();
        if (!submenu.submenus?.length || submenuHref === '#' || !submenuHref) continue;
        if (!path.startsWith(submenuHref) || submenuHref.length <= bestLength) continue;

        best = { parentLabel: submenu.label, items: submenu.submenus as Level3Item[] };
        bestLength = submenuHref.length;
      }
    }

    return best;
  };

  const level3Menu = (() => {
    // New PAL brings its own sub-nav. Every other route — including the legacy
    // PAL workspace under LMS + PAL → Test → PAL — falls through to the normal
    // menu-driven resolution below and gets whatever its own menu defines.
    const newPalItems = newPalLevel3Items(pathname, displayedMenuItems);
    if (newPalItems) {
      return { parentLabel: 'New PAL', items: newPalItems };
    }
    // Fees shows its seven categories here; each links to its own page, which
    // carries that category's menus as its own tab bar. The hook returns null
    // for every non-Fees context, so no other module's navigation is affected.
    // For Fees it never returns null — it holds a loading placeholder instead —
    // so the old Fees level-3 list below is unreachable, even for one frame.
    if (feesLevel3Menu) {
      return feesLevel3Menu;
    }
    if (selectedL2?.submenus?.length) {
      return { parentLabel: selectedL2.label, items: selectedL2.submenus as Level3Item[] };
    }
    const found = searchLevel3FromMenu(displayedMenuItems, pathname);
    if (!found) return null;
    return found;
  })();

  const showSubheader = Boolean(level3Menu?.items.length || fetchedMasterMenuItems.length > 0 || masterMenuGroups.length > 0);

  return (
    /*
      Wraps both the page and the assistant, because the two have to share it: pages
      register what they are showing, the panel reads it. Mounted at the shell rather
      than the root layout so it covers exactly the surface the assistant appears on.
    */
    <PageAiContextProvider>
    <div className="app-shell-background flex h-screen overflow-hidden">
      <Sidebar
        menuItems={displayedMenuItems}
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
    </PageAiContextProvider>
  );
}







