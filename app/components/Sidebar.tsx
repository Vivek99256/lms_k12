'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { ChevronRight, LayoutDashboard, Menu, RefreshCw } from 'lucide-react';
import { MenuItem, SubmenuItem, Level3Item } from '@/app/data/menuItems';
import { mapApiLinkToRoute } from '@/app/data/routeMapper';
import { resolveModuleDashboardRoute } from '@/app/data/moduleDashboards';

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
  top?: number;
  bottom?: number;
  left: number;
  maxHeight: number;
}

const LEVEL2_ITEMS_PER_COLUMN = 10;
const LEVEL2_COLUMN_WIDTH = 200;
const LEVEL2_COLUMN_GAP = 12;
const LEVEL2_PANEL_PADDING = 20;
const MAX_LEVEL2_PANEL_WIDTH = 960;
const VIEWPORT_GUTTER = 16;
const POPUP_OFFSET = 8;
const LEVEL2_ITEM_HEIGHT = 40;
const LEVEL2_ITEM_GAP = 2;
const LEVEL2_POPUP_CHROME_HEIGHT = 84;

function itemMatchesPath(item: MenuItem, pathname: string) {
  const currentPath = pathname.toLowerCase();
  const normalizeHref = (href?: string) => (href ?? '').toLowerCase();

  if (item.href && item.href !== '#' && currentPath.startsWith(normalizeHref(item.href))) return true;

  return Boolean(item.submenus?.some((submenu) => {
    if (submenu.href !== '#' && currentPath.startsWith(normalizeHref(submenu.href))) return true;
    const dashboardRoute = resolveModuleDashboardRoute(submenu.label);
    if (dashboardRoute && currentPath.startsWith(dashboardRoute.toLowerCase())) return true;
    return submenu.submenus?.some((level3) => level3.href !== '#' && currentPath === normalizeHref(level3.href));
  }));
}

export default function Sidebar({ menuItems, loading, error, refetch, onLevel1Select, onLevel2Select }: SidebarProps) {
  const pathname = usePathname() || '';
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [level2Panel, setLevel2Panel] = useState<Level2PanelState | null>(null);

  const openLevel2Panel = (item: MenuItem, element: HTMLElement) => {
    if (!item.submenus?.length) return;

    const rect = element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const columnCount = Math.ceil(item.submenus.length / LEVEL2_ITEMS_PER_COLUMN);
    const contentWidth = columnCount * LEVEL2_COLUMN_WIDTH
      + Math.max(0, columnCount - 1) * LEVEL2_COLUMN_GAP
      + LEVEL2_PANEL_PADDING;
    const popupWidth = Math.min(contentWidth, MAX_LEVEL2_PANEL_WIDTH, viewportWidth - VIEWPORT_GUTTER * 2);
    const maxPopupHeight = viewportHeight * 0.8;
    const spaceBelow = viewportHeight - rect.bottom - POPUP_OFFSET - VIEWPORT_GUTTER;
    const spaceAbove = rect.top - POPUP_OFFSET - VIEWPORT_GUTTER;
    const visibleItems = Math.min(item.submenus.length, LEVEL2_ITEMS_PER_COLUMN);
    const preferredHeight = LEVEL2_POPUP_CHROME_HEIGHT
      + visibleItems * LEVEL2_ITEM_HEIGHT
      + Math.max(0, visibleItems - 1) * LEVEL2_ITEM_GAP;
    const requiredHeight = Math.min(preferredHeight, maxPopupHeight);
    const canOpenBelow = spaceBelow >= requiredHeight;
    const canOpenAbove = spaceAbove >= requiredHeight;
    const openAbove = !canOpenBelow && canOpenAbove;
    const useViewportPosition = !canOpenBelow && !canOpenAbove;
    const availableHeight = useViewportPosition
      ? maxPopupHeight
      : Math.max(0, openAbove ? spaceAbove : spaceBelow);

    setLevel2Panel({
      item,
      ...(useViewportPosition
        ? { top: Math.max(VIEWPORT_GUTTER, (viewportHeight - maxPopupHeight) / 2) }
        : openAbove
        ? { bottom: viewportHeight - rect.top + POPUP_OFFSET }
        : { top: rect.bottom + POPUP_OFFSET }),
      left: Math.max(VIEWPORT_GUTTER, Math.min(rect.right + POPUP_OFFSET, viewportWidth - popupWidth - VIEWPORT_GUTTER)),
      maxHeight: Math.min(maxPopupHeight, availableHeight),
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

  const closeSidebarAfterSelection = () => {
    setLevel2Panel(null);
    setIsCollapsed(true);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-level2-panel]') && !target.closest('[data-menu-item]')) {
        setLevel2Panel(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLevel2Panel(null);
      }
    };

    const handlePageScroll = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest?.('[data-level2-panel]')) {
        setLevel2Panel(null);
      }
    };

    if (level2Panel) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('scroll', handlePageScroll, true);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('scroll', handlePageScroll, true);
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
      closeSidebarAfterSelection();
    }
  };

  const handleLevel2Click = (submenu: SubmenuItem) => {
    if (!level2Panel) return;

    onLevel2Select(submenu, level2Panel.item);
    setLevel2Panel(null);

    // Modules with a dashboard (Fees, Admissions, Students, Library, Hostel,
    // Transportation) land there first — Level 2 → module dashboard →
    // Level 3 screen — rather than jumping straight into a Level 3 screen.
    // Everything else keeps using the API 'link', falling back to 'href'.
    const navigateRoute = resolveModuleDashboardRoute(submenu.label)
      ?? (submenu.link ? mapApiLinkToRoute(submenu.link) : submenu.href);
    if (navigateRoute && navigateRoute !== '#') {
      router.push(navigateRoute);
    }
    closeSidebarAfterSelection();
  };

  const showInitialLoading = loading && menuItems.length === 0;
  const isDashboardActive = pathname === '/dashboard';
  const level2Submenus = level2Panel?.item.submenus ?? [];
  const level2Columns = Array.from(
    { length: Math.ceil(level2Submenus.length / LEVEL2_ITEMS_PER_COLUMN) },
    (_, columnIndex) => level2Submenus.slice(
      columnIndex * LEVEL2_ITEMS_PER_COLUMN,
      (columnIndex + 1) * LEVEL2_ITEMS_PER_COLUMN
    )
  );
  const level2ContentWidth = level2Columns.length * LEVEL2_COLUMN_WIDTH
    + Math.max(0, level2Columns.length - 1) * LEVEL2_COLUMN_GAP
    + LEVEL2_PANEL_PADDING;
  const level2PanelWidth = Math.min(level2ContentWidth, MAX_LEVEL2_PANEL_WIDTH);

  return (
    <div
      className={`${isCollapsed ? 'w-[104px]' : 'w-[280px]'} h-full p-4 shrink-0 flex flex-col transition-[width] duration-700 ease-in-out relative group z-50`}
    >
      <div className="bg-white/80 backdrop-blur-xl w-full h-full rounded-[28px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-200/50 flex flex-col relative">
        <button
          type="button"
          onClick={() => {
            setIsCollapsed((collapsed) => !collapsed);
            setLevel2Panel(null);
          }}
          className={`pt-8 pb-6 flex w-full items-center transition-all duration-500 ${isCollapsed ? 'justify-center' : 'px-5 justify-between'}`}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? (
            <div className="w-10 h-10 border border-lg rounded-xl flex items-center justify-center text-gray-600 shrink-0">
              <ChevronRight size={20} aria-hidden="true" />
            </div>
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
        </button>

        <div className={`flex-1 overflow-y-auto py-2 scrollbar-hide ${isCollapsed ? 'px-2' : 'px-4'}`}>
          {!isCollapsed && (
            <div className="text-[11px] font-bold text-gray-400 mb-4 px-2 uppercase tracking-widest whitespace-nowrap overflow-hidden transition-all duration-500">
              Menu
            </div>
          )}
          <nav className="space-y-1">
            <a
              href="/dashboard"
              title={isCollapsed ? 'Dashboard' : ''}
              onClick={(event) => {
                event.preventDefault();
                router.push('/dashboard');
                closeSidebarAfterSelection();
              }}
              className={`flex items-center rounded-2xl text-sm font-semibold transition-all duration-500 group relative overflow-hidden cursor-pointer
                ${isDashboardActive
                  ? 'text-[#0D6EFD] bg-blue-50/80'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50/80'
                }
                ${isCollapsed ? 'justify-center p-3' : 'px-3 py-3 gap-3'}`}
            >
              {isDashboardActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#0D6EFD] rounded-r-full" />
              )}
              <LayoutDashboard
                size={20}
                strokeWidth={isDashboardActive ? 2.5 : 2}
                className={`shrink-0 transition-transform duration-500 ${isDashboardActive ? 'scale-110' : 'group-hover:scale-110 text-gray-400 group-hover:text-gray-600'}`}
              />
              {!isCollapsed && <span className="flex-1 whitespace-nowrap overflow-hidden">Dashboard</span>}
            </a>

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
                    {hasSubmenu && (
                      <ChevronRight
                        size={16}
                        className={isCollapsed ? 'absolute right-1 text-gray-400' : 'text-gray-400'}
                      />
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
          className="fixed flex flex-col bg-white rounded-2xl border border-gray-200/70 shadow-[0_8px_30px_rgb(0,0,0,0.08)] py-3"
          style={{
            top: level2Panel.top === undefined ? undefined : `${level2Panel.top}px`,
            bottom: level2Panel.bottom === undefined ? undefined : `${level2Panel.bottom}px`,
            left: `${level2Panel.left}px`,
            width: `min(${level2PanelWidth}px, calc(100vw - 32px))`,
            maxHeight: `${level2Panel.maxHeight}px`,
            zIndex: 9999,
          }}
        >
          <div className="shrink-0 px-4 py-2 mb-1">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Level 2 Menu</p>
            <h3 className="text-sm font-bold text-gray-900 truncate">{level2Panel.item.label}</h3>
          </div>
          <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto overflow-y-auto scroll-smooth scrollbar-hide px-3 pb-2 pr-2">
            {level2Columns.map((column, columnIndex) => (
              <div key={columnIndex} className="w-[200px] shrink-0 space-y-1">
                {column.map((submenu, itemIndex) => {
                  const SubIcon = submenu.icon;
                  const hasLevel3 = Boolean(submenu.submenus?.length);
                  const dashboardRoute = resolveModuleDashboardRoute(submenu.label);
                  const lowerPathname = pathname.toLowerCase();
                  const isSubActive =
                    (dashboardRoute && lowerPathname.startsWith(dashboardRoute.toLowerCase())) ||
                    (submenu.href !== '#' && (pathname.startsWith(submenu.href) || pathname === submenu.href)) ||
                    Boolean(submenu.submenus?.some((level3) => level3.href !== '#' && lowerPathname.startsWith(level3.href.toLowerCase())));

                  return (
                    <button
                      key={`${submenu.label}-${columnIndex * LEVEL2_ITEMS_PER_COLUMN + itemIndex}`}
                      type="button"
                      onClick={() => handleLevel2Click(submenu)}
                      className={`h-10 w-full flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-semibold transition-all cursor-pointer text-left
                        ${isSubActive
                          ? 'border-blue-100 bg-blue-50/80 text-[#0D6EFD] shadow-sm'
                          : 'border-gray-200/80 bg-white text-gray-600 shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:border-gray-300 hover:bg-gray-50/80 hover:text-gray-900 hover:shadow-sm'
                        }`}
                    >
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${isSubActive ? 'bg-blue-100 text-[#0D6EFD]' : 'bg-gray-100 text-gray-500'}`}>
                        {SubIcon ? <SubIcon size={15} /> : submenu.label.charAt(0).toUpperCase()}
                      </span>
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
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
