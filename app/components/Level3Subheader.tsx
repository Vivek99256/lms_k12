'use client';

import React, { useRef, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { SubmenuItem } from '@/app/data/menuItems';
import { mapApiLinkToRoute } from '@/app/data/routeMapper';

interface Level3ItemProps {
  id?: number | string;
  label: string;
  href: string;
  link?: string | null;
}

interface Level3SubheaderProps {
  items: Level3ItemProps[];
  parentLabel: string;
  mainMenuId?: number | string;
  menuId?: number | string;
  masterItems: SubmenuItem[];
  masterLoading?: boolean;
  masterMenuGroups?: Record<string, unknown>[];
  userProfileName?: string;
}

function getPathFromUrl(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function hasMasterAccess(userProfileName: string): boolean {
  const role = userProfileName.trim().toLowerCase();
  return role === 'admin' || role === 'teacher';
}

/**
 * Get navigation route from item - uses 'link' field directly from API
 */
function getNavigationRoute(item: Level3ItemProps | SubmenuItem): string | null {
  // Use 'link' field directly from API (no modifications)
  if (item.link) {
    const route = mapApiLinkToRoute(item.link);
    if (route && route !== '#') {
      return route;
    }
  }
  
  // Fallback to 'href' field
  if (item.href && item.href !== '#') {
    return item.href;
  }
  
  return null;
}

export default function Level3Subheader({ items, parentLabel, masterItems = [], masterLoading = false, masterMenuGroups = [], userProfileName = '' }: Level3SubheaderProps) {
  const router = useRouter();
  const pathname = (usePathname() || '').toLowerCase();
  const [showMasterDropdown, setShowMasterDropdown] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const saved = sessionStorage.getItem('masterMenuOpen');
      return saved === 'true';
    } catch {
      return false;
    }
  });
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [selectedMasterCategory, setSelectedMasterCategory] = useState<string | number | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem('selectedMasterCategory');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && masterMenuGroups.some((g) => (g.id as string | number) === parsed)) {
          return parsed;
        }
      }
    } catch {}
    return null;
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const tabsWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem('masterMenuOpen', String(showMasterDropdown));
    } catch {}
  }, [showMasterDropdown]);

  useEffect(() => {
    if (!showMasterDropdown && masterMenuGroups.length > 0 && fetchedMasterItems.length > 0) {
      const wasOpen = typeof window !== 'undefined' && sessionStorage.getItem('masterMenuOpen') === 'true';
      if (wasOpen) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setShowMasterDropdown(true);
      }
    }
  }, [masterMenuGroups, fetchedMasterItems, showMasterDropdown]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (selectedMasterCategory) {
      localStorage.setItem('selectedMasterCategory', JSON.stringify(selectedMasterCategory));
    } else {
      localStorage.removeItem('selectedMasterCategory');
    }
  }, [selectedMasterCategory]);

  const checkScrollability = () => {
    const el = containerRef.current;
    if (!el) return;
    const tolerance = 2;
    setCanScrollLeft(el.scrollLeft > tolerance);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - tolerance);
  };

  const scroll = (direction: 'left' | 'right') => {
    const el = containerRef.current;
    if (!el) return;
    const scrollAmount = el.clientWidth * 0.7;
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const handleMasterClick = (item: SubmenuItem) => {
    setShowMasterDropdown(false);
    const navigateRoute = getNavigationRoute(item);
    if (navigateRoute) {
      router.push(navigateRoute);
    }
  };

  const handleMasterButtonClick = () => {
    const willOpen = !showMasterDropdown;
    setShowMasterDropdown((prev) => !prev);
    if (willOpen && masterMenuGroups.length > 0) {
      setSelectedMasterCategory(masterMenuGroups[0].id as string | number);
    }
  };

  useEffect(() => {
    checkScrollability();

    const handleResize = () => checkScrollability();
    window.addEventListener('resize', handleResize);

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(checkScrollability);
    });
    if (tabsWrapperRef.current) {
      observer.observe(tabsWrapperRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, [items]);

  if ((!items || items.length === 0) && masterItems.length === 0) return null;

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-[28px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-200/50 px-4 py-3">
      <div className="flex items-center gap-3">
        {items.length > 0 && (
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap shrink-0">
            {parentLabel}
          </span>
        )}

        <div className="flex items-center gap-2 flex-1 overflow-hidden">
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                canScrollLeft
                  ? 'bg-white border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300 shadow-sm'
                  : 'bg-gray-50 text-gray-300 cursor-not-allowed'
              }`}
            >
              <ChevronLeft size={16} />
            </button>
          )}

          <div className="flex-1 flex items-center overflow-hidden" ref={tabsWrapperRef}>
            <div
              className="flex gap-2 overflow-x-auto scrollbar-hide flex-1"
              ref={containerRef}
              onScroll={checkScrollability}
            >
              {items.map((item, idx) => {
                // Use 'link' field directly from API
                const navigateRoute = getNavigationRoute(item);
                const isActive = navigateRoute ? pathname === navigateRoute.toLowerCase() : false;
                
                const handleClick = () => {
                  if (navigateRoute) {
                    router.push(navigateRoute);
                  }
                };
                
                return (
                  <button
                    key={item.id ?? idx}
                    type="button"
                    onClick={handleClick}
                    className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border shrink-0 ${
                      isActive
                        ? 'bg-[#0D6EFD] text-white border-[#0D6EFD] shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:text-gray-900'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {items.length > 0 && (
            <button
              type="button"
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                canScrollRight
                  ? 'bg-white border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300 shadow-sm'
                  : 'bg-gray-50 text-gray-300 cursor-not-allowed'
              }`}
            >
              <ChevronRight size={16} />
            </button>
          )}
        </div>

        {hasMasterAccess(userProfileName) && (masterMenuGroups.length > 0 || fetchedMasterItems.length > 0 || masterItems.length > 0) && (
          <div className="relative shrink-0" data-master-dropdown>
            <button
              type="button"
              onClick={handleMasterButtonClick}
              className="px-5 py-2.5 bg-[#0D6EFD] hover:bg-blue-600 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5"
            >
              Master
            </button>

            {showMasterDropdown && (
              <div className="absolute right-0 top-full mt-3 w-[640px] max-h-[420px] overflow-hidden bg-white rounded-2xl shadow-[0_20px_50px_rgb(0,0,0,0.15)] border border-gray-100 z-50">
                {masterLoading && (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-[#0D6EFD] border-t-transparent rounded-full animate-spin mr-3" />
                    <span className="text-sm font-medium text-gray-500">Loading master menu...</span>
                  </div>
                )}
                {!masterLoading && (
                  <div className="flex h-full">
                    {masterMenuGroups.length > 0 ? (
                      <>
                        <div className="w-48 bg-gray-50/80 border-r border-gray-100 p-3 overflow-y-auto">
                          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-2">Categories</p>
                          <div className="space-y-1">
                            {masterMenuGroups.map((group: Record<string, unknown>) => {
                              const groupId = group.id as string | number;
                              const groupName = String(group.name ?? '');
                              const iconName = String(group.icon ?? '');
                              const isActive = selectedMasterCategory === groupId;
                              const iconColors: Record<string, string> = {
                                student: 'bg-blue-100 text-blue-600',
                                madal: 'bg-purple-100 text-purple-600',
                                school: 'bg-emerald-100 text-emerald-600',
                                setting: 'bg-orange-100 text-orange-600',
                                chart: 'bg-cyan-100 text-cyan-600',
                              };
                              const iconColor = iconColors[iconName] || 'bg-gray-100 text-gray-600';

                              return (
                                <button
                                  key={String(groupId)}
                                  type="button"
                                  onClick={() => setSelectedMasterCategory(groupId)}
                                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                                    isActive
                                      ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
                                      : 'text-gray-600 hover:bg-white/60 hover:text-gray-900'
                                  }`}
                                >
                                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconColor}`}>
                                    <span className="text-[11px] font-bold uppercase">{groupName.charAt(0)}</span>
                                  </span>
                                  <span className="truncate">{groupName}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex-1 p-5 overflow-y-auto">
                          {(() => {
                            const selectedGroup = masterMenuGroups.find((g) => g.id === selectedMasterCategory);
                            const children = (selectedGroup as Record<string, unknown>)?.children as Record<string, unknown>[] | undefined;
                            if (!children || children.length === 0) {
                              return (
                                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                                  <p className="text-sm font-medium">No items in this category</p>
                                </div>
                              );
                            }
                            return (
                              <div className="grid grid-cols-2 gap-2.5">
                                {children.map((child: Record<string, unknown>) => {
                                  // Use 'link' from API, fallback to 'href' or 'url', map through routeMapper
                                  const childLink = String(child.link ?? child.url ?? child.href ?? '#');
                                  const childRoute = childLink !== '#' ? mapApiLinkToRoute(childLink) : '#';
                                  const childName = String(child.name ?? '');
                                  const isActive = pathname === childRoute.toLowerCase();
                                  return (
                                    <button
                                      key={String(child.id ?? childName)}
                                      type="button"
                                      onClick={() => childRoute !== '#' && router.push(childRoute)}
                                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 border ${
                                        isActive
                                          ? 'bg-blue-50/80 border-blue-200 text-[#0D6EFD] shadow-sm'
                                          : 'bg-white border-gray-100 text-gray-700 hover:border-gray-200 hover:shadow-sm hover:bg-gray-50/50'
                                      }`}
                                    >
                                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                                        isActive ? 'bg-blue-100 text-[#0D6EFD]' : 'bg-gray-100 text-gray-500'
                                      }`}>
                                        {childName.charAt(0)}
                                      </span>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium truncate">{childName}</p>
                                      </div>
                                      {isActive && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#0D6EFD] shrink-0" />
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
                      </>
                    ) : (
                      <div className="p-2">
                        {!masterLoading && masterItems.map((item) => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={String(item.id ?? item.href ?? item.label)}
                              type="button"
                              onClick={() => handleMasterClick(item)}
                              className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50/80 transition-colors"
                            >
                              {Icon ? (
                                <Icon size={16} className="shrink-0 text-gray-400" />
                              ) : (
                                <span className="w-4 h-4 shrink-0 flex items-center justify-center">
                                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                                </span>
                              )}
                              <span className="min-w-0 flex-1 truncate">{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
