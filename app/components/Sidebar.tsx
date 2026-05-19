'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, BookOpen, Calendar, FileText, BarChart3, 
  MessageCircle, Settings 
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname() || '';
  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
    { icon: BookOpen, label: 'Subjects', href: '/subjects' },
    { icon: Calendar, label: 'Curriculum Planning', href: '#' },
    { icon: FileText, label: 'Assessments', href: '#' },
    { icon: BarChart3, label: 'Reports & Analytics', href: '#' },
    { icon: MessageCircle, label: 'Messages', href: '#' },
    { icon: Settings, label: 'Settings', href: '#' },
  ];

  return (
    <div className="w-72 bg-white sidebar p-6 flex flex-col h-full border-r border-gray-100">
      <div className="flex items-center gap-3 mb-10">
        <div className="w-10 h-10 bg-[#0D6EFD] rounded-xl flex items-center justify-center">
          <span className="text-white font-bold text-xl">TC</span>
        </div>
        <h1 className="font-semibold text-xl tracking-tight">Teach Connect</h1>
      </div>

      <nav className="space-y-1 flex-1">
        {menuItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = item.href !== '#' && pathname.startsWith(item.href);
          return (
            <a key={index} href={item.href} className={`menu-item flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 ${isActive ? 'active !text-white' : ''}`}>
              <Icon size={18} /> {item.label}
            </a>
          );
        })}
      </nav>

      <div className="mt-auto bg-gradient-to-br from-[#0D6EFD] to-[#7ED957] rounded-2xl p-5 text-white text-sm font-medium">
        Empower Learning.<br />Inspire Growth.
      </div>
    </div>
  );
}
