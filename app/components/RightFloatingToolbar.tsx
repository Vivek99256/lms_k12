'use client';

import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Bot,
  Network,
  Sparkle,
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
  accentFrom: string;
  accentTo: string;
  options: ToolbarOption[];
};

const toolbarMenus: ToolbarMenu[] = [
  {
    id: 'conversational-ai',
    label: 'AI STACK - Conversational AI',
    icon: Bot,
    accentFrom: '#0D6EFD',
    accentTo: '#7ED957',
    options: [
      {
        title: 'AI STACK - Conversational AI',
        description: 'Launch chat-driven experiences for guided support, Q&A, and interactive workflows.',
      },
    ],
  },
  {
    id: 'generative-ai',
    label: 'AI STACK - Generative AI',
    icon: Sparkle,
    accentFrom: '#2563EB',
    accentTo: '#0D6EFD',
    options: [
      {
        title: 'AI STACK - Generative AI',
        description: 'Create content, drafts, visuals, and structured outputs from prompts and context.',
      },
    ],
  },
  {
    id: 'knowledge-graph',
    label: 'AI STACK - Knowledge Graph',
    icon: Network,
    accentFrom: '#0D6EFD',
    accentTo: '#10B981',
    options: [
      {
        title: 'AI STACK - Knowledge Graph',
        description: 'Connect entities, topics, and relationships for richer discovery and reasoning.',
      },
    ],
  },
  {
    id: 'recommendation-engine',
    label: 'AI STACK - Recommendation Engine',
    icon: Sparkles,
    accentFrom: '#16A34A',
    accentTo: '#84CC16',
    options: [
      {
        title: 'AI STACK - Recommendation Engine',
        description: 'Surface personalized suggestions, next-best actions, and relevant content paths.',
      },
    ],
  },
];

function OptionCard({ option }: { option: ToolbarOption }) {
  return (
    <button className="group w-full rounded-2xl border border-gray-200/80 bg-white p-4 text-left shadow-[0_1px_0_rgba(15,23,42,0.03)] transition-all hover:-translate-y-0.5 hover:border-[#0D6EFD]/20 hover:bg-blue-50/40 hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-600 ring-1 ring-gray-200 transition-colors group-hover:bg-blue-50 group-hover:text-[#0D6EFD] group-hover:ring-[#0D6EFD]/15">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-900">{option.title}</div>
          <div className="mt-1 text-xs leading-5 text-gray-500">{option.description}</div>
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
  const [activeMenuId, setActiveMenuId] = useState<string | null>(toolbarMenus[0]?.id ?? null);
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
      aria-label="Floating AI Stack toolbar"
    >
      <div
        className="flex flex-col-reverse items-end gap-3 transition-all duration-300 ease-out md:flex-row md:items-center md:gap-3"
      >
        {activeMenu && (
          <aside
            className="w-[min(88vw,20rem)] overflow-hidden rounded-[28px] border border-gray-200/70 bg-white/95 shadow-[0_22px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl md:w-[22rem] lg:w-[24rem]"
            role="dialog"
            aria-label={activeMenu.label}
          >
            <div
              className="px-5 py-4 text-white"
              style={{
                background: `linear-gradient(135deg, ${activeMenu.accentFrom} 0%, ${activeMenu.accentTo} 100%)`,
              }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/75">
                AI Stack
              </p>
              <h2 className="mt-1 text-lg font-semibold leading-tight">{activeMenu.label}</h2>
              <p className="mt-1 text-sm text-white/80">
                Explore the available AI capabilities from the floating stack.
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

        <div className="flex flex-col gap-2 rounded-[28px] border border-gray-200/70 bg-white/90 p-2 shadow-[0_18px_50px_rgba(15,23,42,0.14)] backdrop-blur-xl">
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
                    ? 'border-[#0D6EFD]/15 bg-blue-50 text-[#0D6EFD] shadow-[0_10px_22px_rgba(13,110,253,0.16)]'
                    : 'border-transparent bg-white text-gray-500 hover:border-gray-200 hover:bg-gray-50 hover:text-gray-900'
                }`}
                title={menu.label}
                aria-pressed={isActive}
                >
                <span
                  className={`absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-200 group-hover:opacity-[0.08] ${
                    isActive ? 'opacity-10' : ''
                  }`}
                  style={{
                    background: `linear-gradient(135deg, ${menu.accentFrom} 0%, ${menu.accentTo} 100%)`,
                  }}
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
