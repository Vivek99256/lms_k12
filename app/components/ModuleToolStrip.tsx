'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChevronDown,
  CirclePlus,
  FileClock,
  GitBranch,
  LifeBuoy,
  SlidersHorizontal,
  UserPlus,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

import type { Level3Item } from '@/app/data/menuItems';

/**
 * Category keys that live in this strip instead of the category bar.
 *
 * They are the setup-and-support categories every module carries; keeping them
 * out of the bar leaves it for the module's working screens. Matched against the
 * bar item ids the module hook writes (`<module>-category-<key>`), so a module
 * that has none of them is simply unaffected.
 */
export const TOOL_STRIP_CATEGORY_KEYS = [
  'onboarding',
  'process-builder',
  'master-setup',
  'help-guide-support',
  'workflow',
  'audit-trail',
] as const;

const TOOL_ICONS: Record<(typeof TOOL_STRIP_CATEGORY_KEYS)[number], LucideIcon> = {
  onboarding: UserPlus,
  'process-builder': CirclePlus,
  'master-setup': SlidersHorizontal,
  'help-guide-support': LifeBuoy,
  workflow: GitBranch,
  'audit-trail': FileClock,
};

function categoryKeyOf(item: Level3Item): (typeof TOOL_STRIP_CATEGORY_KEYS)[number] | null {
  const id = String(item.id ?? '');

  return TOOL_STRIP_CATEGORY_KEYS.find((key) => id.endsWith(`-category-${key}`)) ?? null;
}

export function isToolStripCategory(item: Level3Item): boolean {
  return categoryKeyOf(item) !== null;
}

function isOpenable(href: string | undefined): href is string {
  return Boolean(href) && href !== '#';
}

/**
 * A slim row of the module's setup and support tools: a dot and the module name,
 * then each tool as an icon and a label.
 *
 * A tool with screens under it (Master Setup) carries a small arrow and opens
 * them in a list under itself; the first row of that list opens the tool's own
 * page, so drilling in never costs the page the tool opens on its own. A tool
 * without screens goes straight to its page.
 */
export default function ModuleToolStrip({
  label,
  items,
  visible = true,
}: {
  label: string;
  items: Level3Item[];
  /** False while the strip is folded away; an open list closes with it. */
  visible?: boolean;
}) {
  const router = useRouter();
  const pathname = (usePathname() || '').toLowerCase();
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<{ index: number; left: number; top: number } | null>(null);

  useEffect(() => {
    if (!open) return;

    const close = () => setOpen(null);
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (panelRef.current?.contains(target as Node) || target?.closest?.('[data-tool-toggle]')) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', close);
    // Capture: the strip scrolls sideways inside itself, which would otherwise
    // leave the list hanging where the tool used to be.
    document.addEventListener('scroll', close, true);

    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', close);
      document.removeEventListener('scroll', close, true);
    };
  }, [open]);

  // A different module's strip must not inherit an open list, and a folded-away
  // strip must not leave one hanging. Keyed on the tools' ids rather than the
  // array: the shell builds a fresh array on every render, which would close the
  // list the moment it opened.
  const itemsKey = items.map((item) => String(item.id ?? '')).join('|');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(null);
  }, [itemsKey, pathname, visible]);

  if (items.length === 0) return null;

  const go = (href: string) => {
    setOpen(null);
    router.push(href);
  };

  const openItem = open ? items[open.index] : null;
  const openChildren = openItem?.children ?? [];

  const rowClass =
    'flex w-full items-center rounded-xl px-3 py-2 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-[#0D6EFD]/10 hover:text-[#0D6EFD] disabled:cursor-not-allowed disabled:text-gray-300';

  return (
    <div className="flex items-center gap-1 overflow-x-auto rounded-[28px] border border-gray-200/50 bg-white/80 px-5 py-2.5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl scrollbar-hide">
      <span className="flex shrink-0 items-center gap-2 whitespace-nowrap text-xs font-bold uppercase tracking-widest text-[#0D6EFD]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#0D6EFD]" aria-hidden="true" />
        {label}
      </span>
      <span className="mx-3 h-5 w-px shrink-0 bg-gray-200" aria-hidden="true" />

      {items.map((item, index) => {
        const key = categoryKeyOf(item);
        const Icon = key ? TOOL_ICONS[key] : Workflow;
        const children = item.children ?? [];
        const hasChildren = children.length > 0;
        const isOpen = open?.index === index;
        const href = item.href;
        const isActive = isOpenable(href) && pathname.startsWith(href.split('?')[0].toLowerCase());

        return (
          <button
            key={`${item.id ?? 'tool'}-${index}`}
            type="button"
            data-tool-toggle={hasChildren ? '' : undefined}
            aria-haspopup={hasChildren ? 'menu' : undefined}
            aria-expanded={hasChildren ? isOpen : undefined}
            disabled={!hasChildren && !isOpenable(href)}
            onClick={(event) => {
              if (!hasChildren) {
                if (isOpenable(href)) go(href);
                return;
              }
              if (isOpen) {
                setOpen(null);
                return;
              }
              const rect = event.currentTarget.getBoundingClientRect();
              setOpen({
                index,
                // Keep the 256px list inside the viewport.
                left: Math.max(8, Math.min(rect.left, window.innerWidth - 264)),
                top: rect.bottom + 8,
              });
            }}
            className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              isActive || isOpen
                ? 'bg-[#0D6EFD]/10 text-[#0D6EFD]'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <Icon size={16} strokeWidth={1.8} className="shrink-0" />
            {item.label}
            {hasChildren ? (
              <ChevronDown size={13} className={`shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            ) : null}
          </button>
        );
      })}

      {open &&
        openItem &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            className="fixed z-[100] max-h-[min(60vh,420px)] w-64 overflow-y-auto rounded-2xl border border-gray-200/50 bg-white p-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.12)]"
            style={{ left: open.left, top: open.top }}
          >
            {isOpenable(openItem.href) ? (
              <button type="button" role="menuitem" onClick={() => go(openItem.href)} className={`${rowClass} font-semibold`}>
                Open {openItem.label}
              </button>
            ) : null}
            {openChildren.map((child, childIndex) => (
              <button
                key={`${child.id ?? 'child'}-${childIndex}`}
                type="button"
                role="menuitem"
                disabled={!isOpenable(child.href)}
                onClick={() => isOpenable(child.href) && go(child.href)}
                className={rowClass}
              >
                <span className="truncate">{child.label}</span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
