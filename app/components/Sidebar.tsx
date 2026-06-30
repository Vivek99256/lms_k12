'use client';

import React, { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { 
  LayoutDashboard, BookOpen, Calendar, FileText, BarChart3, 
  MessageCircle, Settings, Menu
} from 'lucide-react';
import { menuItems as sharedMenuItems, MenuItem } from '@/app/data/menuItems';

interface FlyoutState {
  label: string;
  top: number;
  left: number;
}

export default function Sidebar() {
  const pathname = usePathname() || '';
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [flyoutState, setFlyoutState] = useState<FlyoutState | null>(null);
  const flyoutTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sidebarLeaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const menuItems = sharedMenuItems;

  const closeFlyout = () => setFlyoutState(null);

  const handleMenuEnter = (item: MenuItem, e: React.MouseEvent) => {
    if (flyoutTimeoutRef.current) {
      clearTimeout(flyoutTimeoutRef.current);
      flyoutTimeoutRef.current = null;
    }
    if (item.submenus && item.submenus.length > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      setFlyoutState({
        label: item.label,
        top: rect.top,
        left: rect.right + 8,
      });
    } else {
      setFlyoutState(null);
    }
  };

  const handleMenuLeave = () => {
    flyoutTimeoutRef.current = setTimeout(() => {
      setFlyoutState(null);
    }, 200);
  };

  const handleFlyoutEnter = () => {
    if (flyoutTimeoutRef.current) {
      clearTimeout(flyoutTimeoutRef.current);
      flyoutTimeoutRef.current = null;
    }
  };

  const handleFlyoutLeave = () => {
    setFlyoutState(null);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-flyout]') && !target.closest('[data-menu-item]')) {
        setFlyoutState(null);
      }
    };
    if (flyoutState) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [flyoutState]);

  useEffect(() => {
    return () => {
      if (flyoutTimeoutRef.current) clearTimeout(flyoutTimeoutRef.current);
      if (sidebarLeaveTimeoutRef.current) clearTimeout(sidebarLeaveTimeoutRef.current);
    };
  }, []);

  const handleSubmenuClick = (href: string) => {
    router.push(href);
    setFlyoutState(null);
  };

  const flyoutItem = flyoutState 
    ? menuItems.find(item => item.label === flyoutState.label && item.submenus) 
    : null;

  return (
    <div 
      onMouseEnter={() => {
        if (sidebarLeaveTimeoutRef.current) clearTimeout(sidebarLeaveTimeoutRef.current);
        if (flyoutTimeoutRef.current) clearTimeout(flyoutTimeoutRef.current);
        setIsCollapsed(false);
      }}
      onMouseLeave={() => {
        sidebarLeaveTimeoutRef.current = setTimeout(() => {
          setIsCollapsed(true);
          setFlyoutState(null);
        }, 300);
      }}
      className={`${isCollapsed ? 'w-[104px]' : 'w-[280px]'} h-full p-4 shrink-0 flex flex-col transition-[width] duration-700 ease-in-out relative group z-50`}
    >
      <div className="bg-white/80 backdrop-blur-xl w-full h-full rounded-[28px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-200/50 flex flex-col relative">
        
        {/* Header / Logo */}
        <div className={`pt-8 pb-6 flex items-center transition-all duration-500 ${isCollapsed ? 'justify-center' : 'px-5 justify-between'}`}>
          {isCollapsed ? (
            <div className="w-9 h-9 bg-gradient-to-br from-[#0D6EFD] to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-bold shrink-0">
              TC
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-9 h-9 bg-gradient-to-br from-[#0D6EFD] to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-bold shrink-0">
                  TC
                </div>
                <h1 className="font-bold text-lg tracking-tight text-gray-900 whitespace-nowrap overflow-hidden">
                  Teach Connect
                </h1>
              </div>
              
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-600 shrink-0">
                <Menu size={20} />
              </div>
            </>
          )}
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
              const isActive = item.href && item.href !== '#' && pathname.startsWith(item.href);
              const hasSubmenu = item.submenus && item.submenus.length > 0;
              
              return (
                <div
                  key={index}
                  data-menu-item
                  className="relative"
                  onMouseEnter={(e) => handleMenuEnter(item, e)}
                  onMouseLeave={handleMenuLeave}
                >
                  <a 
                    href={item.href}
                    title={isCollapsed ? item.label : ''}
                    onClick={(e) => {
                      e.preventDefault();
                      if (hasSubmenu) {
                        if (flyoutState?.label === item.label) {
                          setFlyoutState(null);
                        } else {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setFlyoutState({
                            label: item.label,
                            top: rect.top,
                            left: rect.right + 8,
                          });
                        }
                      } else if (item.href && item.href !== '#') {
                        router.push(item.href);
                      }
                    }}
                    className={`flex items-center rounded-2xl text-sm font-semibold transition-all duration-500 group relative overflow-hidden cursor-pointer
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
                    {hasSubmenu && !isCollapsed && (
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </a>
                </div>
              );
            })}
          </nav>
        </div>

        {/* User Card */}
        <div className={`pb-4 mt-auto flex ${isCollapsed ? 'justify-center px-2' : 'px-4'}`}>
          <div className={`bg-gray-50/80 border border-gray-100 flex items-center hover:bg-gray-100 transition-colors w-full ${isCollapsed ? 'p-2 rounded-[20px] justify-center' : 'p-3 rounded-2xl gap-3'}`}>
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

      {/* Portal Flyout */}
      {flyoutItem && typeof document !== 'undefined' && createPortal(
        <div
          data-flyout
          className="fixed bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-200/50 py-3"
          style={{ 
            top: `${flyoutState!.top}px`, 
            left: `${flyoutState!.left}px`, 
            minWidth: '220px',
            zIndex: 9999,
          }}
          onMouseEnter={() => {
            if (flyoutTimeoutRef.current) clearTimeout(flyoutTimeoutRef.current);
            if (sidebarLeaveTimeoutRef.current) clearTimeout(sidebarLeaveTimeoutRef.current);
            flyoutTimeoutRef.current = null;
            sidebarLeaveTimeoutRef.current = null;
          }}
          onMouseLeave={() => {
            if (flyoutTimeoutRef.current) clearTimeout(flyoutTimeoutRef.current);
            if (sidebarLeaveTimeoutRef.current) clearTimeout(sidebarLeaveTimeoutRef.current);
            setFlyoutState(null);
            setIsCollapsed(true);
          }}
        >
         <div className="px-4 py-2 mb-1">
           <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{flyoutItem.label}</h3>
         </div>
         {flyoutItem.submenus!.map((submenu, subIndex) => {
           const SubIcon = submenu.icon;
           const isSubActive = submenu.href !== '#' && (pathname.startsWith(submenu.href) || pathname === submenu.href);
           const hasLevel3 = submenu.submenus && submenu.submenus.length > 0;
           return (
             <div key={subIndex}>
               <a
                 href={submenu.href}
                 data-flyout
                 onClick={(e) => {
                   e.preventDefault();
                   handleSubmenuClick(submenu.href);
                 }}
                 className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer
                   ${isSubActive 
                     ? 'text-[#0D6EFD] bg-blue-50/80' 
                     : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50/80'
                   }`}
               >
                 {SubIcon && (
                   <SubIcon size={16} className={`shrink-0 ${isSubActive ? 'text-[#0D6EFD]' : 'text-gray-400'}`} />
                 )}
                 <span>{submenu.label}</span>
                 {hasLevel3 && (
                   <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">+{submenu.submenus!.length}</span>
                 )}
               </a>
               {hasLevel3 && (
                 <div className="px-4 pb-3 space-y-1">
                   {submenu.submenus!.map((level3, l3Idx) => {
                     const isLevel3Active = pathname === level3.href;
                     return (
                       <a
                         key={l3Idx}
                         href={level3.href}
                         data-flyout
                         onClick={(e) => {
                           e.preventDefault();
                           handleSubmenuClick(level3.href);
                         }}
                         className={`flex items-center gap-2 px-4 py-2 text-xs font-medium transition-colors cursor-pointer
                           ${isLevel3Active 
                             ? 'text-[#0D6EFD] bg-blue-50/80 rounded-lg' 
                             : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50/80 rounded-lg'
                           }`}
                       >
                         <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50" />
                         <span>{level3.label}</span>
                       </a>
                     );
                   })}
                 </div>
               )}
             </div>
           );
         })}
        </div>,
        document.body
      )}
    </div>
  );
}
