'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import Sidebar from '@/app/components/Sidebar';
import Header from '@/app/components/Header';
import ChatbotPanel from '@/app/components/ChatbotPanel';
import RightFloatingToolbar from '@/app/components/RightFloatingToolbar';
import Level3Subheader from '@/app/components/Level3Subheader';
import { type Level3Item, type MenuItem, type SubmenuItem } from '@/app/data/menuItems';
import { useMenuRights } from '@/app/hooks/useMenuRights';
import { usePathname, useRouter } from 'next/navigation';
import { mapApiLinkToRoute } from '@/app/data/routeMapper';

interface SelectedBranch {
  level1Key: string;
  level2Key: string;
}

function getMenuKey(item: { id?: number | string; label: string; href?: string }) {
  return String(item.id ?? item.href ?? item.label);
}

function isMasterMenu(item: { menuType?: string | null }) {
  return item.menuType?.toUpperCase() === 'MASTER';
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
           (l3) => {
             const mappedRoute = l3.link ? mapApiLinkToRoute(l3.link) : l3.href;
             return mappedRoute && mappedRoute !== '#' && currentPath === mappedRoute.toLowerCase();
           }
         );
         
         if (!hasMatchingLevel3) {
           const firstLevel3 = selectedLevel2.submenus[0];
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
  }, [menuItems, selectedBranch, pathname, router]);

  const toggleChatbot = () => setIsChatbotOpen((prev) => !prev);

  const handleLevel1Select = (item: MenuItem) => {
    setSelectedBranch((current) => {
      const key = getMenuKey(item);
      return current?.level1Key === key ? { level1Key: key, level2Key: '' } : { level1Key: key, level2Key: '' };
    });
  };

  const handleLevel2Select = (submenu: SubmenuItem, parent: MenuItem) => {
    setSelectedBranch({
      level1Key: getMenuKey(parent),
      level2Key: getMenuKey(submenu),
    });

    if (submenu.submenus && submenu.submenus.length > 0) {
      const firstLevel3 = submenu.submenus[0];
      // Use link field mapped to route, fallback to href
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

  const masterMenuItems = useMemo(() => {
    if (!selectedL1) return [];
    return selectedL1.submenus ?? [];
  }, [selectedL1]);

  const isMasterSelected = isMasterMenu(selectedL1 || {});

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

  const showSubheader = Boolean(level3Menu?.items.length || (isMasterSelected && masterMenuItems.length > 0));

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
                  masterItems={isMasterSelected ? masterMenuItems : []}
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
