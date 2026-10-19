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
  dynamicLevel2Counts?: Record<string, number | undefined>;
  onLevel1Select: (item: MenuItem) => void;
  onLevel2Select: (submenu: SubmenuItem, parent: MenuItem) => void;
  /** Rendered as the phone-width drawer: always expanded, and closing it closes the drawer. */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
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

export default function Sidebar({
  menuItems,
  loading,
  error,
  refetch,
  dynamicLevel2Counts = {},
  onLevel1Select,
  onLevel2Select,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname() || '';
  const router = useRouter();
  const [collapsedState, setIsCollapsed] = useState(true);
  // The phone drawer is only ever shown expanded — a rail inside a drawer would be pointless.
  const isCollapsed = collapsedState && !mobileOpen;
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
    onMobileClose?.();
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
      className={`${isCollapsed ? 'w-[88px]' : 'w-[264px]'} h-full p-3 shrink-0 flex flex-col transition-[width] duration-200 ease-out motion-reduce:transition-none relative group z-50`}
    >
      <div className="bg-white w-full h-full rounded-2xl shadow-sm border border-slate-200 flex flex-col relative">
        <button
          type="button"
          onClick={() => {
            if (mobileOpen) {
              onMobileClose?.();
            } else {
              setIsCollapsed((collapsed) => !collapsed);
            }
            setLevel2Panel(null);
          }}
          className={`pt-6 pb-5 flex w-full items-center rounded-t-2xl outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#4F46E5]/40 ${isCollapsed ? 'justify-center' : 'px-4 justify-between'}`}
          aria-label={mobileOpen ? 'Close navigation' : isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? (
            <div className="w-10 h-10 border border-slate-200 rounded-xl flex items-center justify-center text-slate-600 shrink-0 hover:bg-slate-50">
              <ChevronRight size={20} aria-hidden="true" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 overflow-hidden">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-9 h-9 rounded-xl object-contain shrink-0" />
                ) : (
                  <div className="w-9 h-9 bg-[#4F46E5] rounded-xl flex items-center justify-center text-white text-sm font-semibold shrink-0">
                    TC
                  </div>
                )}
                <span className="font-semibold text-base tracking-tight text-slate-900 truncate">
                  {schoolName}
                </span>
              </div>

              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 shrink-0 hover:bg-slate-50">
                <Menu size={20} />
              </div>
            </>
          )}
        </button>

        <div className={`flex-1 overflow-y-auto py-2 scrollbar-hide ${isCollapsed ? 'px-2' : 'px-3'}`}>
          {!isCollapsed && (
            <div className="text-[11px] font-semibold text-slate-400 mb-3 px-3 uppercase tracking-widest whitespace-nowrap overflow-hidden">
              Menu
            </div>
          )}
          <nav className="space-y-1" aria-label="Main">
            <a
              href="/dashboard"
              title={isCollapsed ? 'Dashboard' : ''}
              aria-current={isDashboardActive ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault();
                router.push('/dashboard');
                closeSidebarAfterSelection();
              }}
              className={`flex items-center rounded-xl text-sm font-medium transition-colors duration-150 group relative overflow-hidden cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]/40
                ${isDashboardActive
                  ? 'text-[#4F46E5] bg-indigo-50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }
                ${isCollapsed ? 'justify-center p-3' : 'px-3 py-2.5 gap-3'}`}
            >
              {isDashboardActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#4F46E5] rounded-r-full" />
              )}
              <LayoutDashboard
                size={20}
                strokeWidth={isDashboardActive ? 2.25 : 1.75}
                className={`shrink-0 ${isDashboardActive ? '' : 'text-slate-400 group-hover:text-slate-600'}`}
              />
              {!isCollapsed && <span className="flex-1 whitespace-nowrap overflow-hidden">Dashboard</span>}
            </a>

            {showInitialLoading && (
              <div className="space-y-2">
                {[...Array(7)].map((_, index) => (
                  <div key={index} className="h-11 rounded-xl animate-pulse bg-slate-100" />
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
                  title="Try again"
                  className={`flex items-center justify-center rounded-xl bg-white text-red-600 border border-red-100 hover:bg-red-50 transition-colors ${isCollapsed ? 'w-10 h-10' : 'w-full gap-2 px-3 py-2 text-xs font-bold'}`}
                >
                  <RefreshCw size={15} />
                  {!isCollapsed && <span>Try again</span>}
                </button>
              </div>
            )}

            {!showInitialLoading && !error && menuItems.length === 0 && (
              <div className={`rounded-2xl bg-gray-50/80 text-gray-500 ${isCollapsed ? 'p-2' : 'p-3'}`}>
                {!isCollapsed ? (
                  <p className="text-xs font-semibold leading-relaxed">You don't have access to any menus yet. Contact your school administrator.</p>
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
                    aria-current={isActive ? 'page' : undefined}
                    aria-expanded={hasSubmenu ? isPanelOpen : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      handleLevel1Click(item, event.currentTarget);
                    }}
                    className={`flex items-center rounded-xl text-sm font-medium transition-colors duration-150 group relative overflow-hidden cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]/40
                      ${isActive || isPanelOpen
                        ? 'text-[#4F46E5] bg-indigo-50'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }
                      ${isCollapsed ? 'justify-center p-3' : 'px-3 py-2.5 gap-3'}`}
                  >
                    {(isActive || isPanelOpen) && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#4F46E5] rounded-r-full" />
                    )}
                    <Icon
                      size={20}
                      strokeWidth={isActive || isPanelOpen ? 2.25 : 1.75}
                      className={`shrink-0 ${isActive || isPanelOpen ? '' : 'text-slate-400 group-hover:text-slate-600'}`}
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
      </div>

      {level2Panel && typeof document !== 'undefined' && createPortal(
        <div
          data-level2-panel
          className="fixed flex flex-col rounded-2xl border bg-popover py-3 shadow-lg"
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
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Module</p>
            <h3 className="truncate text-sm font-bold text-popover-foreground">{level2Panel.item.label}</h3>
          </div>
          <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto overflow-y-auto scroll-smooth scrollbar-hide px-3 pb-2 pr-2">
            {level2Columns.map((column, columnIndex) => (
              <div key={columnIndex} className="w-[200px] shrink-0 space-y-1">
                {column.map((submenu, itemIndex) => {
                  const SubIcon = submenu.icon;
                  const countKey = submenu.label.trim().replace(/\s+/g, ' ').toLowerCase();
                  const dynamicCount = dynamicLevel2Counts[countKey];
                  const level3Count = dynamicCount ?? submenu.submenus?.length ?? 0;
                  const hasLevel3 = level3Count > 0;
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
                      className={`h-10 w-full flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]/40
                        ${isSubActive
                          ? 'border-[#4F46E5]/20 bg-indigo-50 text-[#4F46E5] shadow-sm'
                          : 'border-border bg-card text-muted-foreground shadow-xs hover:border-muted-foreground/30 hover:bg-muted/60 hover:text-foreground hover:shadow-sm'
                        }`}
                    >
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${isSubActive ? 'bg-[#4F46E5]/10 text-[#4F46E5]' : 'bg-muted text-muted-foreground'}`}>
                        {SubIcon ? <SubIcon size={15} /> : submenu.label.charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{submenu.label}</span>
                      {hasLevel3 && (
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          +{level3Count}
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
