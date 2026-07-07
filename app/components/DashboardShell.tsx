'use client';

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from '@/app/components/Sidebar';
import Header from '@/app/components/Header';
import ChatbotPanel from '@/app/components/ChatbotPanel';
import RightFloatingToolbar from '@/app/components/RightFloatingToolbar';
import Level3Subheader from '@/app/components/Level3Subheader';
import { type Level3Item, type MenuItem, type SubmenuItem } from '@/app/data/menuItems';
import { useMenuRights, getStoredMenuContext } from '@/app/hooks/useMenuRights';
import { usePathname, useRouter } from 'next/navigation';
import { API_BASE_URL } from '@/app/components/utils/api_url';
import { mapApiLinkToRoute } from '@/app/data/routeMapper';

interface SelectedBranch {
  level1Key: string;
  level2Key: string;
}

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

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const router = useRouter();
  const { menuItems, loading, error, refetch } = useMenuRights();
  const hasLoadedRef = useRef(false);

  const [selectedBranch, setSelectedBranch] = useState<SelectedBranch | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem('selectedMenuBranch');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.level1Key && parsed?.level2Key) {
          return parsed;
        }
      }
    } catch {}
    return null;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (selectedBranch) {
      localStorage.setItem('selectedMenuBranch', JSON.stringify(selectedBranch));
    } else {
      localStorage.removeItem('selectedMenuBranch');
    }
  }, [selectedBranch]);
  const [isChatbotOpen, setIsChatbotOpen] = useState(true);

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

   const fetchMasterMenu = useCallback(async (mainMenuId: number | string | undefined, menuItem: SubmenuItem | undefined) => {
    if (!mainMenuId || !menuItem) return;

    const cacheKey = `${mainMenuId}-${menuItem.id}`;
    if (masterMenuFetchedFor === cacheKey) return;

    const session = getStoredMenuContext();
    if (!session) return;

    setMasterMenuLoading(true);
    try {
      const url = new URL(`${API_BASE_URL}/api/master-menu-rights`);
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
      } else {``
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
    } catch {
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

  const toggleChatbot = () => setIsChatbotOpen((prev) => !prev);

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

  const staticMasterMenuItems = useMemo(() => {
    if (!selectedL1) return [];
    return selectedL1.submenus ?? [];
  }, [selectedL1]);

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
    if (selectedL2?.submenus?.length) {
      return { parentLabel: selectedL2.label, items: selectedL2.submenus as Level3Item[] };
    }
    const found = searchLevel3FromMenu(menuItems, pathname);
    return found;
  })();

  const showSubheader = Boolean(level3Menu?.items.length || fetchedMasterMenuItems.length > 0 || masterMenuGroups.length > 0);

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      <Sidebar
        menuItems={menuItems}
        loading={loading}
        error={error}
        refetch={refetch}
        onLevel1Select={handleLevel1Select}
        onLevel2Select={handleLevel2Select}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onToggleChatbot={toggleChatbot} isChatbotOpen={isChatbotOpen} />
        <div className="flex-1 flex overflow-hidden">
          <main className={`flex-1 overflow-auto transition-all duration-300 scrollbar-hide ${isChatbotOpen ? 'w-[85%]' : 'w-full'}`}>
            {showSubheader && (
              <div className="px-6 pt-4">
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
          </main>
          {isChatbotOpen && (
            <div className="w-[15%] min-w-[320px] overflow-hidden mt-[10px]">
              <ChatbotPanel onToggleChatbot={toggleChatbot} />
            </div>
          )}
        </div>
        <RightFloatingToolbar isChatbotOpen={isChatbotOpen} />
      </div>
    </div>
  );
}
