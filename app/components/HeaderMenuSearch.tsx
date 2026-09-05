'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CornerDownLeft, Search, X } from 'lucide-react';
import type { MenuItem } from '@/app/data/menuItems';
import {
  buildMenuSearchIndex,
  highlightSegments,
  searchMenuIndex,
  type MenuSearchEntry,
} from '@/app/data/menuSearch';

const LEVEL_LABEL: Record<number, string> = { 1: 'Category', 2: 'Module', 3: 'Screen' };

/**
 * Top-bar search over this user's own menu tree: type a menu name, press enter,
 * land on that screen. The tree is already rights-filtered by the shell, so the
 * results only ever contain screens this profile is allowed to open.
 */
export default function HeaderMenuSearch({
  menuItems,
  onNavigate,
}: {
  menuItems: MenuItem[];
  onNavigate: (entry: MenuSearchEntry) => void;
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const index = useMemo(() => buildMenuSearchIndex(menuItems), [menuItems]);
  const results = useMemo(() => searchMenuIndex(index, query), [index, query]);

  const measure = useCallback(() => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({ top: rect.bottom + 8, left: rect.left, width: rect.width });
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setActiveIndex(0);
  }, []);

  const openWithQuery = (value: string) => {
    setQuery(value);
    setActiveIndex(0);
    if (value.trim().length >= 2) {
      measure();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  const goTo = (entry: MenuSearchEntry | undefined) => {
    if (!entry) return;
    onNavigate(entry);
    setQuery('');
    close();
    inputRef.current?.blur();
  };

  // Ctrl/Cmd+K is the app-wide shortcut into search; Escape gives the field back.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrapperRef.current?.contains(target) || listRef.current?.contains(target)) return;
      close();
    };
    // The panel is portalled to the body, so it has to follow the top bar itself.
    const onReflow = () => measure();

    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [isOpen, close, measure]);

  // Keep the highlighted row in view while arrowing through a long result list.
  useEffect(() => {
    if (!isOpen) return;
    const active = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, isOpen]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      if (query) setQuery('');
      close();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!results.length) return;
      event.preventDefault();
      if (!isOpen) {
        measure();
        setIsOpen(true);
        return;
      }
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => (current + step + results.length) % results.length);
      return;
    }
    if (event.key === 'Enter') {
      if (!isOpen || !results.length) return;
      event.preventDefault();
      goTo(results[activeIndex]?.entry);
    }
  };

  const showPanel = isOpen && position && typeof document !== 'undefined' && query.trim().length >= 2;

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="search-bar flex items-center rounded-full border border-gray-200 bg-white py-2 pl-5 pr-3">
        <Search size={18} className="mr-3 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={Boolean(showPanel)}
          aria-controls="header-menu-search-results"
          aria-autocomplete="list"
          autoComplete="off"
          value={query}
          placeholder="Search menus and screens..."
          className="flex-1 bg-transparent text-sm outline-none"
          onChange={(event) => openWithQuery(event.target.value)}
          onFocus={() => {
            if (query.trim().length >= 2) {
              measure();
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery('');
              close();
              inputRef.current?.focus();
            }}
            className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        ) : (
          <span className="hidden select-none rounded-md border border-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 sm:inline">
            Ctrl K
          </span>
        )}
      </div>

      {showPanel && createPortal(
        <div
          ref={listRef}
          id="header-menu-search-results"
          role="listbox"
          className="fixed z-[9999] max-h-[380px] overflow-y-auto rounded-2xl border border-gray-200/70 bg-white py-2 shadow-[0_8px_30px_rgb(0,0,0,0.12)]"
          style={{ top: position.top, left: position.left, width: position.width }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-500">
              No menu matches &ldquo;{query.trim()}&rdquo;.
            </p>
          ) : (
            results.map((result, resultIndex) => {
              const { entry } = result;
              const isActive = resultIndex === activeIndex;
              return (
                <button
                  key={entry.key}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  data-active={isActive}
                  onMouseEnter={() => setActiveIndex(resultIndex)}
                  onClick={() => goTo(entry)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left transition-colors ${
                    isActive ? 'bg-blue-50/80' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-gray-800">
                      {highlightSegments(entry.label, query).map((segment, segmentIndex) => (
                        <span
                          key={segmentIndex}
                          className={segment.match ? 'font-semibold text-[#0D6EFD]' : undefined}
                        >
                          {segment.text}
                        </span>
                      ))}
                    </span>
                    <span className="block truncate text-[11px] text-gray-400">
                      {[...entry.trail, LEVEL_LABEL[entry.level]].join(' / ')}
                    </span>
                  </span>
                  {isActive && <CornerDownLeft size={14} className="shrink-0 text-gray-400" />}
                </button>
              );
            })
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
