'use client';

import React, { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  LayoutDashboard, BookOpen, Calendar, FileText, BarChart3, 
  MessageCircle, Settings, Menu
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname() || '';
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
    { icon: BookOpen, label: 'Subjects', href: '/subjects' },
    { icon: Calendar, label: 'Planning', href: '#' },
    { icon: FileText, label: 'Assessments', href: '#' },
    { icon: BarChart3, label: 'Analytics', href: '#' },
    { icon: MessageCircle, label: 'Messages', href: '#' },
    { icon: Settings, label: 'Settings', href: '#' },
  ];

  return (
    <div 
      className={`${isCollapsed ? 'w-[104px]' : 'w-[280px]'} h-full p-4 shrink-0 flex flex-col transition-[width] duration-700 ease-in-out relative group z-50`}
    >
      <div className="bg-white/80 backdrop-blur-xl w-full h-full rounded-[28px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-200/50 flex flex-col overflow-hidden relative">
        
        {/* Header / Logo */}
        <div className={`pt-8 pb-6 flex items-center transition-all duration-500 ${isCollapsed ? 'justify-center px-0' : 'px-5 justify-between'}`}>
          <div className={`flex items-center gap-3 overflow-hidden transition-all duration-500 ${isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100 flex'}`}>
            <div className="w-9 h-9 bg-gradient-to-br from-[#0D6EFD] to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-bold shrink-0">
              TC
            </div>
            <h1 className="font-bold text-lg tracking-tight text-gray-900 whitespace-nowrap overflow-hidden">
              Teach Connect
            </h1>
          </div>
          
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-10 h-10 rounded-xl bg-gray-50/50 hover:bg-gray-100 flex items-center justify-center text-gray-600 hover:text-[#0D6EFD] transition-colors shrink-0"
          >
            <Menu size={20} />
          </button>
        </div>

        {/* Navigation */}
        <div className={`flex-1 overflow-y-auto py-2 scrollbar-hide ${isCollapsed ? 'px-2' : 'px-4'}`}>
          {!isCollapsed && (
            <div className="text-[11px] font-bold text-gray-400 mb-4 px-2 uppercase tracking-widest whitespace-nowrap overflow-hidden transition-all duration-500">
              Menu
            </div>
          )}
          <nav className="space-y-1">
            {menuItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = item.href !== '#' && pathname.startsWith(item.href);
              
              return (
                <a 
                  key={index} 
                  href={item.href} 
                  onClick={(e) => {
                    if (isCollapsed && item.href !== '#') {
                      e.preventDefault();
                      setIsCollapsed(false);
                      setTimeout(() => {
                        router.push(item.href);
                      }, 800);
                    } else if (isCollapsed) {
                      setIsCollapsed(false);
                    }
                  }}
                  title={isCollapsed ? item.label : ''}
                  className={`flex items-center rounded-2xl text-sm font-semibold transition-all duration-500 group relative overflow-hidden
                    ${isActive 
                      ? 'text-[#0D6EFD] bg-blue-50/80' 
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50/80'
                    }
                    ${isCollapsed ? 'justify-center p-3' : 'px-3 py-3 gap-3'}`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#0D6EFD] rounded-r-full" />
                  )}
                  <Icon 
                    size={20} 
                    strokeWidth={isActive ? 2.5 : 2} 
                    className={`shrink-0 transition-transform duration-500 ${isActive ? 'scale-110' : 'group-hover:scale-110 text-gray-400 group-hover:text-gray-600'}`} 
                  />
                  {!isCollapsed && (
                    <span className="flex-1 whitespace-nowrap overflow-hidden">{item.label}</span>
                  )}
                </a>
              );
            })}
          </nav>
        </div>

        {/* User Card */}
        <div className={`pb-4 mt-auto flex ${isCollapsed ? 'justify-center px-2' : 'px-4'}`}>
          <div 
            onClick={() => {
              if (isCollapsed) setIsCollapsed(false);
            }}
            className={`bg-gray-50/80 border border-gray-100 flex items-center cursor-pointer hover:bg-gray-100 transition-colors w-full ${isCollapsed ? 'p-2 rounded-[20px] justify-center' : 'p-3 rounded-2xl gap-3'}`}
          >
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-[#0D6EFD] font-bold border-2 border-white shadow-sm shrink-0">
              AD
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-gray-900 truncate">Admin User</h4>
                <p className="text-[11px] text-gray-500 truncate">Premium Plan</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
