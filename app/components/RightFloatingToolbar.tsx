'use client';

import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ChartColumnIncreasing,
  Image as ImageIcon,
  LayoutGrid,
  PencilLine,
  Search,
  SquareStack,
  Table2,
  Type,
  Sparkles,
} from 'lucide-react';

type ToolbarOption = {
  title: string;
  description: string;
};

type ToolbarMenu = {
  id: string;
  label: string;
  icon: LucideIcon;
  accent: string;
  options: ToolbarOption[];
};

const toolbarMenus: ToolbarMenu[] = [
  {
    id: 'search',
    label: 'Search',
    icon: Search,
    accent: 'from-sky-500 to-cyan-500',
    options: [
      { title: 'Quick Search', description: 'Find pages, blocks, or content instantly.' },
      { title: 'Advanced Filter', description: 'Search by tags, type, or usage frequency.' },
      { title: 'Recent Items', description: 'Jump back into recently used elements.' },
      { title: 'Saved Searches', description: 'Reuse common searches with one click.' },
    ],
  },
  {
    id: 'text',
    label: 'Text / Basic Blocks',
    icon: Type,
    accent: 'from-indigo-500 to-blue-500',
    options: [
      { title: 'Heading 1', description: 'Large title for primary sections.' },
      { title: 'Heading 2', description: 'Secondary heading for grouped content.' },
      { title: 'Heading 3', description: 'Tertiary heading for cards and fields.' },
      { title: 'Heading 4', description: 'Compact section label or subheading.' },
      { title: 'Blockquote', description: 'Call out quoted or highlighted content.' },
      { title: 'Label', description: 'Small uppercase label for forms and metadata.' },
      { title: 'Tables', description: 'Structured tabular content and comparisons.' },
      { title: 'Lists', description: 'Bulleted or numbered content blocks.' },
    ],
  },
  {
    id: 'image',
    label: 'Image',
    icon: ImageIcon,
    accent: 'from-emerald-500 to-teal-500',
    options: [
      { title: 'Upload Image', description: 'Add an image from local storage.' },
      { title: 'Image Gallery', description: 'Browse reusable assets and media.' },
      { title: 'Hero Banner', description: 'Insert a wide visual with text overlay.' },
      { title: 'Image Card', description: 'Combine an image with title and description.' },
    ],
  },
  {
    id: 'layout',
    label: 'Layout / Components',
    icon: LayoutGrid,
    accent: 'from-violet-500 to-fuchsia-500',
    options: [
      { title: 'Two Column', description: 'Split the canvas into two balanced areas.' },
      { title: 'Three Column', description: 'Create a wider multi-column layout.' },
      { title: 'Stack', description: 'Vertical content flow with generous spacing.' },
      { title: 'Tabs', description: 'Segment content into switchable panels.' },
      { title: 'Accordion', description: 'Hide and reveal grouped sections.' },
      { title: 'Modal', description: 'Open focused actions without leaving the page.' },
    ],
  },
  {
    id: 'chart',
    label: 'Chart',
    icon: ChartColumnIncreasing,
    accent: 'from-amber-500 to-orange-500',
    options: [
      { title: 'Bar Chart', description: 'Compare values across categories.' },
      { title: 'Line Chart', description: 'Show trends over time.' },
      { title: 'Pie Chart', description: 'Display proportions of a whole.' },
      { title: 'Area Chart', description: 'Visualize a cumulative trend.' },
      { title: 'Metric Card', description: 'Highlight a key KPI or summary.' },
    ],
  },
  {
    id: 'table',
    label: 'Table',
    icon: Table2,
    accent: 'from-slate-600 to-slate-900',
    options: [
      { title: 'Data Table', description: 'Grid rows and columns for structured data.' },
      { title: 'Compact Table', description: 'Dense layout for admin screens.' },
      { title: 'Sortable Table', description: 'Enable column sorting controls.' },
      { title: 'Export Table', description: 'Prepare a table for CSV or print export.' },
    ],
  },
  {
    id: 'card',
    label: 'Card / Section',
    icon: SquareStack,
    accent: 'from-rose-500 to-pink-500',
    options: [
      { title: 'Content Card', description: 'Framed section for any block of content.' },
      { title: 'Stat Card', description: 'Display a quick summary or number.' },
      { title: 'Section Header', description: 'Introduce a grouped area with title and note.' },
      { title: 'Feature Card', description: 'Show a prominent item with icon and copy.' },
    ],
  },
  {
    id: 'design',
    label: 'Edit / Design',
    icon: PencilLine,
    accent: 'from-slate-500 to-gray-800',
    options: [
      { title: 'Align Left', description: 'Keep content aligned to the left edge.' },
      { title: 'Center Align', description: 'Center content in the available space.' },
      { title: 'Align Right', description: 'Push content to the right side.' },
      { title: 'Code Block', description: 'Insert a monospaced code region.' },
      { title: 'Divider', description: 'Separate sections with a visual rule.' },
      { title: 'Shape', description: 'Add a decorative shape or callout.' },
    ],
  },
];

function OptionCard({ option }: { option: ToolbarOption }) {
  return (
    <button className="group w-full rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-[0_1px_0_rgba(15,23,42,0.03)] transition-all hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-600 ring-1 ring-slate-200 transition-colors group-hover:bg-sky-50 group-hover:text-sky-600 group-hover:ring-sky-200">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{option.title}</div>
          <div className="mt-1 text-xs leading-5 text-slate-500">{option.description}</div>
        </div>
      </div>
    </button>
  );
}

export default function RightFloatingToolbar({
  isChatbotOpen,
  isOpen,
  onOpenChange,
  toggleButtonRef,
}: {
  isChatbotOpen: boolean;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  toggleButtonRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeMenu = toolbarMenus.find((menu) => menu.id === activeMenuId) ?? null;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (containerRef.current?.contains(target)) {
        return;
      }

      if (toggleButtonRef.current?.contains(target)) {
        return;
      }

      onOpenChange(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onOpenChange, toggleButtonRef]);

  if (isChatbotOpen) {
    return null;
  }

  if (!isOpen) {
    return null;
  }

  const toolbar = (
    <div
      ref={containerRef}
      className="fixed bottom-4 right-3 z-[70] flex items-end md:bottom-auto md:right-4 md:top-1/2 md:-translate-y-1/2 md:items-center"
      aria-label="Floating editor toolbar"
    >
      <div
        className="flex flex-col-reverse items-end gap-3 transition-all duration-300 ease-out md:flex-row md:items-center md:gap-3"
      >
        {activeMenu && (
          <aside
            className="w-[min(88vw,20rem)] overflow-hidden rounded-[28px] border border-slate-200/70 bg-white/95 shadow-[0_22px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl md:w-[22rem] lg:w-[24rem]"
            role="dialog"
            aria-label={activeMenu.label}
          >
            <div className={`bg-gradient-to-r ${activeMenu.accent} px-5 py-4 text-white`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/75">
                Toolbox
              </p>
              <h2 className="mt-1 text-lg font-semibold leading-tight">{activeMenu.label}</h2>
              <p className="mt-1 text-sm text-white/80">
                Browse the matching components and insert the one you need.
              </p>
            </div>

            <div className="max-h-[min(70vh,34rem)] overflow-y-auto p-4 md:max-h-[min(72vh,38rem)]">
              <div className="grid gap-3">
                {activeMenu.options.map((option) => (
                  <OptionCard key={option.title} option={option} />
                ))}
              </div>
            </div>
          </aside>
        )}

        <div className="flex flex-col gap-2 rounded-[28px] border border-slate-200/70 bg-white/90 p-2 shadow-[0_18px_50px_rgba(15,23,42,0.14)] backdrop-blur-xl">
          {toolbarMenus.map((menu) => {
            const isActive = activeMenuId === menu.id;
            const Icon = menu.icon;

            return (
              <button
                key={menu.id}
                type="button"
                onClick={() => setActiveMenuId((current) => (current === menu.id ? null : menu.id))}
                className={`group relative flex h-12 w-12 items-center justify-center rounded-2xl border transition-all duration-200 ${
                  isActive
                    ? 'border-sky-200 bg-sky-50 text-sky-700 shadow-[0_10px_22px_rgba(14,165,233,0.18)]'
                    : 'border-transparent bg-white text-slate-500 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                }`}
                title={menu.label}
                aria-pressed={isActive}
                >
                <span
                  className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${menu.accent} opacity-0 transition-opacity duration-200 group-hover:opacity-[0.08] ${
                    isActive ? 'opacity-10' : ''
                  }`}
                />
                <Icon className="relative h-5 w-5" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') {
    return toolbar;
  }

  return createPortal(toolbar, document.body);
}
