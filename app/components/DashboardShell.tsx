'use client';

import React, { useState } from 'react';
import Sidebar from '@/app/components/Sidebar';
import Header from '@/app/components/Header';
import ChatbotPanel from '@/app/components/ChatbotPanel';
import Level3Subheader from '@/app/components/Level3Subheader';
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
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onToggleChatbot={toggleChatbot} isChatbotOpen={isChatbotOpen} />
        <div className="flex-1 flex overflow-hidden">
          <main className={`flex-1 overflow-auto transition-all duration-300 scrollbar-hide ${isChatbotOpen ? 'w-[85%]' : 'w-full'}`}>
            {showSubheader && (
              <div className="px-6 pt-4">
                <Level3Subheader items={level3Menu!.items} parentLabel={level3Menu!.parentLabel} />
              </div>
            )}
            {children}
          </main>
          {isChatbotOpen && (
            <div className="w-[15%] min-w-[320px] overflow-hidden">
              <ChatbotPanel onToggleChatbot={toggleChatbot} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
