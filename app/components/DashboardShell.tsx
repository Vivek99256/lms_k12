'use client';

import Sidebar from '@/app/components/Sidebar';
import Header from '@/app/components/Header';

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
