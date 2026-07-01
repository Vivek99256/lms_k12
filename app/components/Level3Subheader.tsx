'use client';

import React, { useRef, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { SubmenuItem } from '@/app/data/menuItems';

interface Level3Item {
  label: string;
  href: string;
}

interface Level3SubheaderProps {
  items: Level3Item[];
  parentLabel: string;
  masterItems?: SubmenuItem[];
}

export default function Level3Subheader({ items, parentLabel, masterItems = [] }: Level3SubheaderProps) {
  const router = useRouter();
  const pathname = (usePathname() || '').toLowerCase();
  const [showMasterDropdown, setShowMasterDropdown] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const tabsWrapperRef = useRef<HTMLDivElement>(null);

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
    if (item.href && item.href !== '#') {
      router.push(item.href);
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

  useEffect(() => {
    if (!showMasterDropdown) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-master-dropdown]')) {
        setShowMasterDropdown(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowMasterDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showMasterDropdown]);

  if ((!items || items.length === 0) && masterItems.length === 0) return null;

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-[28px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-200/50 px-4 py-3">
      <div className="flex items-center gap-3">
        {items.length > 0 && (
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap shrink-0">
            {parentLabel}
          </span>
        )}

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
              const isActive = pathname === item.href.toLowerCase();
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    router.push(item.href);
                  }}
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

        {masterItems.length > 0 && (
          <div className="relative shrink-0" data-master-dropdown>
            <button
              type="button"
              onClick={() => setShowMasterDropdown((prev) => !prev)}
              className="px-4 py-2 bg-[#0D6EFD] hover:bg-blue-600 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
            >
              Master
            </button>

            {showMasterDropdown && (
              <div className="absolute right-0 top-full mt-2 w-64 max-h-80 overflow-y-auto bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-200/50 py-2 z-50">
                {masterItems.map((item) => {
                  const Icon = item.icon;
                  if (!Icon) return null;
                  return (
                    <button
                      key={String(item.id ?? item.href ?? item.label)}
                      type="button"
                      onClick={() => handleMasterClick(item)}
                      className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50/80 transition-colors"
                    >
                      <Icon size={16} className="shrink-0 text-gray-400" />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
