'use client';

import React, { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { ChevronRight, Menu, RefreshCw } from 'lucide-react';
import { MenuItem, SubmenuItem } from '@/app/data/menuItems';

interface SidebarProps {
  menuItems: MenuItem[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  onLevel1Select: (item: MenuItem) => void;
  onLevel2Select: (submenu: SubmenuItem, parent: MenuItem) => void;
}

interface Level2PanelState {
  item: MenuItem;
  top: number;
  left: number;
}

function itemMatchesPath(item: MenuItem, pathname: string) {
  const currentPath = pathname.toLowerCase();
  const normalizeHref = (href?: string) => (href ?? '').toLowerCase();

  if (item.href && item.href !== '#' && currentPath.startsWith(normalizeHref(item.href))) return true;

  return Boolean(item.submenus?.some((submenu) => {
    if (submenu.href !== '#' && currentPath.startsWith(normalizeHref(submenu.href))) return true;
    return submenu.submenus?.some((level3) => level3.href !== '#' && currentPath === normalizeHref(level3.href));
  }));
}

export default function Sidebar({ menuItems, loading, error, refetch, onLevel1Select, onLevel2Select }: SidebarProps) {
  const pathname = usePathname() || '';
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [level2Panel, setLevel2Panel] = useState<Level2PanelState | null>(null);
  const panelCloseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sidebarLeaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const openLevel2Panel = (item: MenuItem, element: HTMLElement) => {
    if (!item.submenus?.length) return;

    if (panelCloseTimeoutRef.current) {
      clearTimeout(panelCloseTimeoutRef.current);
      panelCloseTimeoutRef.current = null;
    }

    const rect = element.getBoundingClientRect();
    setLevel2Panel({
      item,
      top: Math.max(16, rect.top),
      left: rect.right + 8,
    });
  };

  const getLogoUrl = () => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem('userData');
      if (stored) {
        const parsed = JSON.parse(stored);
        console.log('Sidebar logoUrl from localStorage:', parsed.logo);
        if (parsed.logo) {
          if (parsed.logo.startsWith('http')) return parsed.logo;
          const base = parsed.host_name || '';
          return base ? `${base}/admin_dep/images/${parsed.logo}` : null;
        }
        return null;
      }
    } catch {}
    return null;
  };

  const getSchoolName = () => {
    if (typeof window === 'undefined') return 'Teach Connect';
    try {
      const stored = localStorage.getItem('userData');
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.school_name || 'Teach Connect';
      }
    } catch {}
    return 'Teach Connect';
  };

  const logoUrl = getLogoUrl();
  const schoolName = getSchoolName();

  const schedulePanelClose = () => {
    panelCloseTimeoutRef.current = setTimeout(() => {
      setLevel2Panel(null);
    }, 180);
  };

  const cancelPanelClose = () => {
    if (panelCloseTimeoutRef.current) {
      clearTimeout(panelCloseTimeoutRef.current);
      panelCloseTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (panelCloseTimeoutRef.current) clearTimeout(panelCloseTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-level2-panel]') && !target.closest('[data-menu-item]')) {
        setLevel2Panel(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLevel2Panel(null);
    };

    if (level2Panel) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [level2Panel]);

  const handleLevel1Click = (item: MenuItem, element: HTMLElement) => {
    onLevel1Select(item);

    if (item.submenus?.length) {
      openLevel2Panel(item, element);
      return;
    }

    if (item.href && item.href !== '#') {
      router.push(item.href);
    }
  };

  const handleLevel2Click = (submenu: SubmenuItem) => {
    if (!level2Panel) return;

    onLevel2Select(submenu, level2Panel.item);
    setLevel2Panel(null);

    if (submenu.submenus?.length) {
      return;
    }

    if (submenu.href && submenu.href !== '#') {
      router.push(submenu.href);
    }
  };

  const showInitialLoading = loading && menuItems.length === 0;

  return (
    <div
      className={`${isCollapsed ? 'w-[104px]' : 'w-[280px]'} h-full p-4 shrink-0 flex flex-col transition-[width] duration-700 ease-in-out relative group z-50`}
    >
      <div className="bg-white/80 backdrop-blur-xl w-full h-full rounded-[28px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-200/50 flex flex-col relative">
        <div className={`pt-8 pb-6 flex items-center transition-all duration-500 ${isCollapsed ? 'justify-center' : 'px-5 justify-between'}`}>
          {isCollapsed ? (
            logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-9 h-9 rounded-xl object-contain shrink-0" />
            ) : (
              <div className="w-9 h-9 bg-gradient-to-br from-[#0D6EFD] to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-bold shrink-0">
                TC
              </div>
            )
          ) : (
            <>
              <div className="flex items-center gap-3 overflow-hidden">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-9 h-9 rounded-xl object-contain shrink-0" />
                ) : (
                  <div className="w-9 h-9 bg-gradient-to-br from-[#0D6EFD] to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-bold shrink-0">
                    TC
                  </div>
                )}
                <h1 className="font-bold text-lg tracking-tight text-gray-900 whitespace-nowrap overflow-hidden">
                  {schoolName}
                </h1>
              </div>

              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-600 shrink-0">
                <Menu size={20} />
              </div>
            </>
          )}
        </div>

        <div className={`flex-1 overflow-y-auto py-2 scrollbar-hide ${isCollapsed ? 'px-2' : 'px-4'}`}>
          {!isCollapsed && (
            <div className="text-[11px] font-bold text-gray-400 mb-4 px-2 uppercase tracking-widest whitespace-nowrap overflow-hidden transition-all duration-500">
              Menu
            </div>
          )}
          <nav className="space-y-1">
            {showInitialLoading && (
              <div className="space-y-2">
                {[...Array(7)].map((_, index) => (
                  <div key={index} className="h-11 rounded-2xl animate-pulse bg-gray-200/60" />
                ))}
              </div>
            )}

            {!showInitialLoading && error && (
              <div className={`rounded-2xl border border-red-100 bg-red-50/80 text-red-600 ${isCollapsed ? 'p-2' : 'p-3'}`}>
                {!isCollapsed && (
                  <p className="text-xs font-semibold leading-relaxed mb-2">{error}</p>
                )}
                <button
                  type="button"
                  onClick={refetch}
                  title="Retry menu"
                  className={`flex items-center justify-center rounded-xl bg-white text-red-600 border border-red-100 hover:bg-red-50 transition-colors ${isCollapsed ? 'w-10 h-10' : 'w-full gap-2 px-3 py-2 text-xs font-bold'}`}
                >
                  <RefreshCw size={15} />
                  {!isCollapsed && <span>Retry</span>}
                </button>
              </div>
            )}

            {!showInitialLoading && !error && menuItems.length === 0 && (
              <div className={`rounded-2xl bg-gray-50/80 text-gray-500 ${isCollapsed ? 'p-2' : 'p-3'}`}>
                {!isCollapsed ? (
                  <p className="text-xs font-semibold leading-relaxed">No menu rights found.</p>
                ) : (
                  <Menu size={18} className="mx-auto" />
                )}
              </div>
            )}

            {menuItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = itemMatchesPath(item, pathname);
              const hasSubmenu = Boolean(item.submenus?.length);
              const isPanelOpen = level2Panel?.item.label === item.label;

              return (
                <div
                  key={`${item.label}-${index}`}
                  data-menu-item
                  className="relative"
                  onMouseEnter={(event) => {
                    cancelPanelClose();
                    if (hasSubmenu) openLevel2Panel(item, event.currentTarget);
                  }}
                  onMouseLeave={schedulePanelClose}
                >
                  <a
                    href={item.href || '#'}
                    title={isCollapsed ? item.label : ''}
                    onClick={(event) => {
                      event.preventDefault();
                      handleLevel1Click(item, event.currentTarget);
                    }}
                    className={`flex items-center rounded-2xl text-sm font-semibold transition-all duration-500 group relative overflow-hidden cursor-pointer
                      ${isActive || isPanelOpen
                        ? 'text-[#0D6EFD] bg-blue-50/80'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50/80'
                      }
                      ${isCollapsed ? 'justify-center p-3' : 'px-3 py-3 gap-3'}`}
                  >
                    {(isActive || isPanelOpen) && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#0D6EFD] rounded-r-full" />
                    )}
                    <Icon
                      size={20}
                      strokeWidth={isActive || isPanelOpen ? 2.5 : 2}
                      className={`shrink-0 transition-transform duration-500 ${isActive || isPanelOpen ? 'scale-110' : 'group-hover:scale-110 text-gray-400 group-hover:text-gray-600'}`}
                    />
                    {!isCollapsed && (
                      <span className="flex-1 whitespace-nowrap overflow-hidden">{item.label}</span>
                    )}
                    {hasSubmenu && !isCollapsed && (
                      <ChevronRight size={16} className="text-gray-400" />
                    )}
                  </a>
                </div>
              );
            })}
          </nav>
        </div>

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

      {level2Panel && typeof document !== 'undefined' && createPortal(
        <div
          data-level2-panel
          className="fixed bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-200/50 py-3"
          style={{
            top: `${level2Panel.top}px`,
            left: `${level2Panel.left}px`,
            width: '260px',
            maxHeight: 'min(520px, calc(100vh - 32px))',
            zIndex: 9999,
          }}
          onMouseEnter={() => {
            cancelPanelClose();
            if (sidebarLeaveTimeoutRef.current) clearTimeout(sidebarLeaveTimeoutRef.current);
          }}
          onMouseLeave={() => {
            schedulePanelClose();
            sidebarLeaveTimeoutRef.current = setTimeout(() => {
              setIsCollapsed(true);
            }, 300);
          }}
        >
          <div className="px-4 py-2 mb-1">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Level 2 Menu</p>
            <h3 className="text-sm font-bold text-gray-900 truncate">{level2Panel.item.label}</h3>
          </div>
          <div className="overflow-y-auto max-h-[440px] px-2 pb-1">
            {level2Panel.item.submenus?.map((submenu, subIndex) => {
              const SubIcon = submenu.icon;
              const hasLevel3 = Boolean(submenu.submenus?.length);
              const isSubActive = submenu.href !== '#' && (pathname.startsWith(submenu.href) || pathname === submenu.href);

              return (
                <button
                  key={`${submenu.label}-${subIndex}`}
                  type="button"
                  onClick={() => handleLevel2Click(submenu)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer text-left
                    ${isSubActive
                      ? 'text-[#0D6EFD] bg-blue-50/80'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50/80'
                    }`}
                >
                  {SubIcon && (
                    <SubIcon size={16} className={`shrink-0 ${isSubActive ? 'text-[#0D6EFD]' : 'text-gray-400'}`} />
                  )}
                  <span className="min-w-0 flex-1 truncate">{submenu.label}</span>
                  {hasLevel3 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium shrink-0">
                      +{submenu.submenus!.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
