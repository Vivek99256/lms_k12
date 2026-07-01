'use client';

import React, { useState } from 'react';
import Sidebar from '@/app/components/Sidebar';
import Header from '@/app/components/Header';
import ChatbotPanel from '@/app/components/ChatbotPanel';
import Level3Subheader from '@/app/components/Level3Subheader';
import RightFloatingToolbar from '@/app/components/RightFloatingToolbar';
import { getCurrentLevel3Menu } from '@/app/data/menuItems';
import { usePathname } from 'next/navigation';

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const [isChatbotOpen, setIsChatbotOpen] = useState(true);

  const toggleChatbot = () => setIsChatbotOpen((prev) => !prev);

  const level3Menu = getCurrentLevel3Menu(pathname);
  const showSubheader = level3Menu !== null && pathname !== '/dashboard';

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <Header onToggleChatbot={toggleChatbot} isChatbotOpen={isChatbotOpen} />
        <div className={`flex-1 min-h-0 overflow-hidden flex flex-col lg:flex-row ${isChatbotOpen ? 'gap-4' : 'gap-0'} p-4 pt-4`}>
          <main className="min-w-0 flex-1 overflow-hidden rounded-[28px]">
            <div className="h-full min-h-0 overflow-auto scrollbar-hide">
              {showSubheader && (
                <div className="px-6 pt-4">
                  <Level3Subheader items={level3Menu!.items} parentLabel={level3Menu!.parentLabel} />
                </div>
              )}
              {children}
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
        <RightFloatingToolbar isChatbotOpen={isChatbotOpen} />
      </div>
    </div>
  );
}
