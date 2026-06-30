'use client';

import React, { useMemo, useState } from 'react';
import Sidebar from '@/app/components/Sidebar';
import Header from '@/app/components/Header';
import ChatbotPanel from '@/app/components/ChatbotPanel';
import Level3Subheader from '@/app/components/Level3Subheader';
import { getCurrentLevel3Menu, type Level3Item, type MenuItem, type SubmenuItem } from '@/app/data/menuItems';
import { useMenuRights } from '@/app/hooks/useMenuRights';
import { usePathname } from 'next/navigation';

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
  const { menuItems, loading, error, refetch } = useMenuRights();
  const [selectedBranch, setSelectedBranch] = useState<SelectedBranch | null>(null);
  const [isChatbotOpen, setIsChatbotOpen] = useState(true);

  const toggleChatbot = () => setIsChatbotOpen((prev) => !prev);

  const handleLevel1Select = (item: MenuItem) => {
    const level1Key = getMenuKey(item);
    setSelectedBranch((current) => (
      current?.level1Key === level1Key ? current : null
    ));
  };

  const handleLevel2Select = (submenu: SubmenuItem, parent: MenuItem) => {
    setSelectedBranch({
      level1Key: getMenuKey(parent),
      level2Key: getMenuKey(submenu),
    });
  };

  const selectedL1 = useMemo(() => {
    if (!selectedBranch) return null;
    return menuItems.find((item) => getMenuKey(item) === selectedBranch.level1Key);
  }, [menuItems, selectedBranch]);

  const masterMenuItems = useMemo(() => {
    if (!selectedL1) return [];
    return selectedL1.submenus ?? [];
  }, [selectedL1]);

  const isMasterSelected = isMasterMenu(selectedL1 || {});

  const selectedLevel3Menu = useMemo(() => {
    if (!selectedBranch) return null;

    const selectedLevel1 = menuItems.find((item) => getMenuKey(item) === selectedBranch.level1Key);
    const selectedLevel2 = selectedLevel1?.submenus?.find((submenu) => getMenuKey(submenu) === selectedBranch.level2Key);

    if (!selectedLevel2?.submenus?.length) return null;

    return {
      parentLabel: selectedLevel2.label,
      items: selectedLevel2.submenus as Level3Item[],
    };
  }, [menuItems, selectedBranch]);

  const level3Menu = selectedLevel3Menu ?? getCurrentLevel3Menu(pathname, menuItems);
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
            <div className="w-[15%] min-w-[320px] overflow-hidden">
              <ChatbotPanel onToggleChatbot={toggleChatbot} />
            </div>
          </main>
          <div
            className={`min-h-0 overflow-hidden transition-[width,opacity] duration-500 ease-in-out ${
              isChatbotOpen
                ? 'w-full lg:w-[clamp(320px,24vw,440px)] opacity-100'
                : 'w-0 opacity-0 pointer-events-none'
            }`}
            aria-hidden={!isChatbotOpen}
          >
            <ChatbotPanel onToggleChatbot={toggleChatbot} />
          </div>
        </div>
      </div>
    </div>
  );
}
