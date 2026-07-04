'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import Sidebar from '@/app/components/Sidebar';
import Header from '@/app/components/Header';
import ChatbotPanel from '@/app/components/ChatbotPanel';
import RightFloatingToolbar from '@/app/components/RightFloatingToolbar';
import Level3Subheader from '@/app/components/Level3Subheader';
import { type Level3Item, type MenuItem, type SubmenuItem } from '@/app/data/menuItems';
import { useMenuRights, getStoredMenuContext } from '@/app/hooks/useMenuRights';
import { usePathname, useRouter } from 'next/navigation';
import { API_BASE_URL } from '@/app/components/utils/api_url';

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

  const [fetchedMasterMenuItems, setFetchedMasterMenuItems] = useState<SubmenuItem[]>([]);
  const [masterMenuGroups, setMasterMenuGroups] = useState<Record<string, unknown>[]>([]);
  const [masterMenuLoading, setMasterMenuLoading] = useState(false);

  const fetchMasterMenu = async (mainMenuId: number | string | undefined, menuItem: SubmenuItem | undefined) => {
    if (!mainMenuId || !menuItem) return;

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
          href: String(item.url ?? item.href ?? '#'),
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
          href: String(item.url ?? item.href ?? '#'),
          icon: undefined,
          submenus: undefined,
        }));
      }

      setFetchedMasterMenuItems(getFilteredMasterMenuItems(mapped, menuItem));
    } catch {
      setFetchedMasterMenuItems([]);
      setMasterMenuGroups([]);
    } finally {
      setMasterMenuLoading(false);
    }
  };

  useEffect(() => {
    if (!hasLoadedRef.current && selectedBranch && menuItems.length > 1) {
      const selectedLevel1 = menuItems.find((item) => getMenuKey(item) === selectedBranch.level1Key);
      const selectedLevel2 = selectedLevel1?.submenus?.find((submenu) => getMenuKey(submenu) === selectedBranch.level2Key);
      if (!selectedLevel2?.submenus?.length) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedBranch(null);
        return;
      }
      
      // If Level 2 has Level 3 items, navigate to the first one if current path doesn't match any Level 3
      if (selectedLevel2?.submenus?.length) {
        const currentPath = pathname.toLowerCase();
        const hasMatchingLevel3 = selectedLevel2.submenus.some(
          (l3) => l3.href && l3.href !== '#' && currentPath === l3.href.toLowerCase()
        );
        
        if (!hasMatchingLevel3) {
          const firstLevel3 = selectedLevel2.submenus[0];
          if (firstLevel3.href && firstLevel3.href !== '#') {
            router.push(firstLevel3.href);
          }
        }
      }
    }
    if (menuItems.length > 0) {
      hasLoadedRef.current = true;
    }
  }, [menuItems, selectedBranch, pathname, router]);

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

    await fetchMasterMenu(parent.id, submenu);

    if (submenu.submenus && submenu.submenus.length > 0) {
      const firstLevel3 = submenu.submenus[0];
      if (firstLevel3.href && firstLevel3.href !== '#') {
        router.push(firstLevel3.href);
      }
    }
  };

  const selectedL1 = useMemo(() => {
    if (!selectedBranch?.level1Key) return null;
    return menuItems.find((item) => getMenuKey(item) === selectedBranch.level1Key) ?? null;
  }, [menuItems, selectedBranch]);

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
          const submenuHref = (submenu.href || '').toLowerCase();
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

  const showSubheader = Boolean(level3Menu?.items.length || staticMasterMenuItems.length > 0);

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
                  masterItems={staticMasterMenuItems}
                  mainMenuId={selectedL1?.id}
                  menuId={selectedL2?.id}
                  masterLoading={masterMenuLoading}
                  fetchedMasterItems={fetchedMasterMenuItems}
                  masterMenuGroups={masterMenuGroups}
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
