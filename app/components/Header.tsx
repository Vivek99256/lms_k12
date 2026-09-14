'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  BadgeCheck, Bell, BookOpen, Bot, Boxes, CalendarClock, ChartLine, ChevronDown,
  CirclePlus, ClipboardCheck, FileClock, FileText, GraduationCap, LayoutDashboard,
  LayoutTemplate, Lightbulb, LogOut, Map as MapIcon, Menu, MessageSquareText,
  MessagesSquare, Plug, Rocket, Server, Share2, Shield, ShieldCheck,
  SlidersHorizontal, Smartphone, UserPlus, Waypoints, Workflow,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { publishSelectedAcademicYear } from '@/lib/academic-year';
import { useRouter } from 'next/navigation';
import HeaderMenuSearch from '@/app/components/HeaderMenuSearch';
import type { MenuItem } from '@/app/data/menuItems';
import type { MenuSearchEntry } from '@/app/data/menuSearch';
import { AI_CAPABILITIES, capabilityHref } from '@shared/ai-intelligence-core';

const platformServicesItems = [
  'RBAC',
  'Workflow',
  'Notification',
  'Template',
  'Scheduler',
  'Document',
  'Integration',
  'Audit',
  'Event Bus',
] as const;

/**
 * The glyph each entry wears in the dropdown, so its cards read the same way the
 * sidebar's Level 2 cards do — icon chip, label, one card per destination.
 *
 * These lists are hard-coded in this file rather than served from
 * `tblmenumaster`, so unlike the sidebar there is no `icon` column to resolve;
 * the mapping lives beside the list it describes. A label with no entry here
 * falls back to its own initial, which is what the sidebar does for an
 * unresolvable icon — a missing glyph never costs the row its shape.
 */
const platformServicesIcons: Record<string, LucideIcon> = {
  'RBAC': ShieldCheck,
  'Workflow': Workflow,
  'Notification': Bell,
  'Template': LayoutTemplate,
  'Scheduler': CalendarClock,
  'Document': FileText,
  'Integration': Plug,
  'Audit': ClipboardCheck,
  'Event Bus': Waypoints,
};

/**
 * AI & Intelligence is no longer a hand-written list.
 *
 * It was an array of twelve labels beside a map of twelve routes, ten of which
 * pointed at `/general/coming-soon?module=<label>` — so the menu knew a name and
 * nothing more, and the next product to want these entries could only copy them.
 * Both now come from `packages/ai-intelligence-core`, which G2G and Enterprise
 * Brain can import. Adding or renaming a capability is a registry edit; this file
 * does not change.
 */
const aiIntelligenceItems = AI_CAPABILITIES.map((capability) => capability.name);

/**
 * Keyed by slug, not by name: the slug is the registry's stable identifier — it
 * is what `/ai/<slug>` and the menu rows are built from — so renaming a
 * capability keeps its icon, while renaming its slug is already a route change
 * nobody makes silently.
 *
 * The glyphs match the ones `2026_09_10_000001_add_ai_intelligence_menu` gives
 * the same twelve rows in `tblmenumaster`, so a capability looks the same
 * whether it is reached from here or from the sidebar.
 */
const aiCapabilityIcons: Record<string, LucideIcon> = {
  'providers': Server,
  'models': Boxes,
  'prompts': MessageSquareText,
  'policies': Shield,
  'agents': Bot,
  'conversational-ai': MessagesSquare,
  'knowledge-rag': BookOpen,
  'recommendations': Lightbulb,
  'knowledge-graph': Share2,
  'evaluation': BadgeCheck,
  'usage-cost': ChartLine,
  'audit': FileClock,
};

const aiIntelligenceIcons: Record<string, LucideIcon> = Object.fromEntries(
  AI_CAPABILITIES.flatMap((capability) => {
    const icon = aiCapabilityIcons[capability.slug];
    return icon ? [[capability.name, icon] as const] : [];
  }),
);

function LogoImage({ url, fallback }: { url: string; fallback: React.ReactNode }) {
  const [hasError, setHasError] = useState(false);

  if (hasError) return <>{fallback}</>;

  return (
    <img
      src={url}
      alt="Logo"
      className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-white object-contain"
      onError={() => setHasError(true)}
    />
  );
}

/**
 * Setting the platform up for a tenant, and describing what it is. These used to
 * sit loose at the top of the profile dropdown; they are grouped here so the
 * dropdown reads as three peer groups instead of a flat list plus two groups.
 *
 * They are deliberately NOT folded into Platform Services or AI & Intelligence:
 * those two are catalogs of what the running platform *provides* (services and
 * AI capabilities), while these are the rollout and configuration screens an
 * admin *operates*, plus two read-only views describing the platform itself.
 */
const platformSetupItems = [
  'Implementation',
  'Onboarding',
  'Add Process',
  'Fields Configuration',
  // 'Group-wise Rights',
  // 'Individual Rights',
  'Mobile App Rights',
  // One consolidated view of every platform service and AI capability, each
  // marked live or coming soon. It sits here rather than in the module nav
  // because it describes the platform, not any one module.
  'Platform Administration',
  // The cross-module roadmap, for when a customer asks what else is coming.
  // Kept next to Platform Administration because the two are siblings: that one
  // covers the platform's own services, this one covers every module.
  "What's Coming",
] as const;

const platformSetupIcons: Record<string, LucideIcon> = {
  'Implementation': Rocket,
  'Onboarding': UserPlus,
  'Add Process': CirclePlus,
  'Fields Configuration': SlidersHorizontal,
  'Group-wise Rights': ShieldCheck,
  'Individual Rights': UserPlus,
  'Mobile App Rights': Smartphone,
  'Platform Administration': LayoutDashboard,
  "What's Coming": MapIcon,
};

/**
 * Academic years and terms both live in one table, `academic_year`, one row per
 * (institute, syear, term). The signed-in institute's rows arrive with the login
 * payload and are refreshed per year from /api/academic-terms, so everything the
 * switcher offers is that institute's own — there are no defaults to fall back on.
 */
type AcademicRow = Record<string, unknown>;

const readCell = (row: AcademicRow | undefined, key: string) => {
  const value = row?.[key];
  return value === null || value === undefined ? '' : String(value).trim();
};

const getStoredSelection = (key: string) => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(key);
};

export default function Header({
  onToggleChatbot,
  isChatbotOpen,
  menuItems = [],
  onMenuSearchNavigate,
}: {
  onToggleChatbot: () => void;
  isChatbotOpen: boolean;
  /** The shell's rights-filtered menu tree — what the top-bar search searches. */
  menuItems?: MenuItem[];
  onMenuSearchNavigate?: (entry: MenuSearchEntry) => void;
}) {
  const { user, logout, refreshAcademicTerms, academicTerms, academicYears } = useAuth();
  const router = useRouter();
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showTermDropdown, setShowTermDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [userPosition, setUserPosition] = useState<{ top: number; right: number } | null>(null);

  const platformSetupRoutes: Record<string, string> = {
    'Implementation': '/general/implementation_management',
    'Onboarding': '/general/onboarding',
    'Add Process': '/general/add_process',
    'Fields Configuration': '/general/fields_configuration',
    'Group-wise Rights': '/general/groupwise_rights',
    'Individual Rights': '/general/individual_rights',
    'Mobile App Rights': '/general/mobile_app_rights',
    'Platform Administration': '/platform-administration',
    "What's Coming": '/platform-roadmap',
  };

  const platformServicesRoutes: Record<string, string> = {
    'RBAC': '/organization-management/role-and-permissions',
    // The three centralised engines every module configures against rather than
    // rebuilding. Each reads the same module/component catalogue, served by
    // Laravel at /api/platform/registry — see config/platform_services.php.
    'Workflow': '/platform-services/workflow',
    'Notification': '/platform-services/notification',
    'Template': '/general/coming-soon?module=Template',
    'Scheduler': '/platform-services/scheduler',
    'Document': '/general/coming-soon?module=Document',
    'Integration': '/general/coming-soon?module=Integration',
    'Audit': '/general/coming-soon?module=Audit',
    'Event Bus': '/general/coming-soon?module=Event Bus',
  };

  // A capability with a working screen keeps its own route; the rest resolve to
  // the shared console at /ai/<slug>, which explains what the capability is and
  // which of the three products use it. The two live routes below are unchanged
  // — they come from the registry rows for Agent Management and Conversational AI.
  const aiIntelligenceRoutes: Record<string, string> = Object.fromEntries(
    AI_CAPABILITIES.map((capability) => [capability.name, capabilityHref(capability)]),
  );

  /**
   * The profile dropdown's groups, in display order — one column each, the three
   * side by side with their items listed underneath, so every destination is one
   * click away instead of three. Every group renders from the same markup below,
   * so adding one is an entry here rather than another copy of the column.
   * Platform Setup is listed last, beside the two capability catalogs, because it
   * is the tenant-facing set rather than a platform one.
   *
   * `href` is the group's own overview screen, which makes the heading a
   * destination rather than a label. Platform Setup has none: it is a set of
   * configuration screens with nothing that summarises them, and pointing its
   * heading at one of its own items would make that item look like the group.
   */
  const menuGroups: {
    label: string;
    href?: string;
    items: readonly string[];
    routes: Record<string, string>;
    icons: Record<string, LucideIcon>;
  }[] = [
    {
      label: 'Platform Services',
      href: '/platform-administration',
      items: platformServicesItems,
      routes: platformServicesRoutes,
      icons: platformServicesIcons,
    },
    {
      label: 'AI & Intelligence',
      href: '/ai',
      items: aiIntelligenceItems,
      routes: aiIntelligenceRoutes,
      icons: aiIntelligenceIcons,
    },
    {
      label: 'Platform Setup',
      items: platformSetupItems,
      routes: platformSetupRoutes,
      icons: platformSetupIcons,
    },
  ];

  // Seeded only from what this browser last chose. Anything else is adopted from
  // the institute's own rows once they resolve, below.
  const [selectedYear, setSelectedYear] = useState<string>(
    () => getStoredSelection('selectedAcademicYear') || ''
  );
  const [selectedTerm, setSelectedTerm] = useState<string>(
    () => getStoredSelection('selectedAcademicTerm') || ''
  );

  /** The institute's academic years, newest first. */
  const years = useMemo(() => {
    const seen = new Set<string>();
    // academicTerms is scoped to one year but still carries its syear, so it
    // keeps the list complete for sessions issued before the year rows existed.
    for (const row of [...academicYears, ...academicTerms]) {
      const syear = readCell(row, 'syear');
      if (syear) seen.add(syear);
    }
    return Array.from(seen).sort((a, b) => Number(b) - Number(a));
  }, [academicTerms, academicYears]);

  // What is actually shown: this browser's stored choice while it is still one of
  // the institute's years, otherwise the institute's most recent year. Derived
  // rather than pushed into state, so it is never briefly wrong on first paint.
  const effectiveYear = selectedYear && years.includes(selectedYear) ? selectedYear : years[0] ?? '';

  /**
   * Terms for the year on screen, in the institute's own sort_order. Term names
   * differ per year for some institutes, so rows for other years are excluded
   * rather than pooled together.
   */
  const terms = useMemo(() => {
    const scoped = effectiveYear
      ? academicTerms.filter((row) => readCell(row, 'syear') === effectiveYear)
      : academicTerms;
    const seen = new Set<string>();
    for (const row of scoped) {
      const title = readCell(row, 'title');
      if (title) seen.add(title);
    }
    return Array.from(seen);
  }, [academicTerms, effectiveYear]);

  // A term belongs to a year, so a choice left over from a different year falls
  // back to the first term this institute defines for the current one.
  const effectiveTerm = selectedTerm && terms.includes(selectedTerm) ? selectedTerm : terms[0] ?? '';



  // Term dropdowns app-wide read `academicTerms`, which only ever comes
  // from login (scoped to that syear) — refetch it whenever the switcher
  // changes years, otherwise every term select goes empty for any other year.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Published rather than written directly, so screens that follow the
    // switcher inside this tab hear about it — localStorage's own `storage`
    // event only ever reaches the OTHER tabs. Same key, same value as before.
    if (effectiveYear) publishSelectedAcademicYear(effectiveYear);
    if (effectiveTerm) localStorage.setItem('selectedAcademicTerm', effectiveTerm);
  }, [effectiveYear, effectiveTerm]);

  // Re-fetch every server-rendered page in the current segment so the
  // dashboard aggregates, fee summaries, and the rest of the app pick up
  // the freshly-selected (year, term) from sessionStorage on the next pass.
  useEffect(() => {
    void refreshAcademicTerms(effectiveYear);
    router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveYear]);

  useEffect(() => {
    // Same reasoning for term changes — the server reads it from sessionStorage
    // too, so we have to nudge the router to re-render with the new value.
    router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveTerm]);

const [yearPosition, setYearPosition] = useState<{ top: number; left: number } | null>(null);
const [termPosition, setTermPosition] = useState<{ top: number; left: number } | null>(null);

const logoUrl = (() => {
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
  })();

  // Only the institute's own values are offered. A stored selection that is no
  // longer in its data stays visible until the effects above replace it, so the
  // switcher never goes blank mid-swap.
  const displayYears = !effectiveYear || years.includes(effectiveYear) ? years : [effectiveYear, ...years];
  const displayTerms = !effectiveTerm || terms.includes(effectiveTerm) ? terms : [effectiveTerm, ...terms];

  const yearButtonRef = useRef<HTMLButtonElement>(null);
  const termButtonRef = useRef<HTMLButtonElement>(null);
  const userButtonRef = useRef<HTMLDivElement>(null);

  const handleYearToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setYearPosition({ top: rect.bottom + 4, left: rect.left });
    setShowYearDropdown(prev => !prev);
  };

  const handleTermToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTermPosition({ top: rect.bottom + 4, left: rect.left });
    setShowTermDropdown(prev => !prev);
  };

  /** Every path that dismisses the dropdown goes through here. */
  const closeUserDropdown = () => {
    setShowUserDropdown(false);
  };

  const handleUserToggle = (e: React.MouseEvent<HTMLDivElement>) => {
    if (showUserDropdown) {
      closeUserDropdown();
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setUserPosition({
      top: rect.bottom + 8,
      right: Math.max(12, window.innerWidth - rect.right),
    });
    setShowUserDropdown(true);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (yearButtonRef.current?.contains(target) || termButtonRef.current?.contains(target) || userButtonRef.current?.contains(target)) {
        return;
      }
      setShowYearDropdown(false);
      setShowTermDropdown(false);
      // Inlined rather than calling closeUserDropdown, so this listener keeps
      // its empty dependency list — setters are stable, that helper is not.
      setShowUserDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // The shell owns menu navigation, because opening a screen also has to move
  // the sidebar's selected branch and its Level 3 sub-header. Without it, a
  // plain route push is still better than a dead search box.
  const handleMenuSearchNavigate = (entry: MenuSearchEntry) => {
    if (onMenuSearchNavigate) {
      onMenuSearchNavigate(entry);
      return;
    }
    if (entry.route) router.push(entry.route);
  };

  const renderDropdown = (
    isOpen: boolean,
    position: { top: number; left: number } | null,
    onSelect: (val: string) => void,
    setShowDropdown: (show: boolean) => void,
    options: string[],
    value: string
  ) => {
    if (!isOpen || !position || typeof document === 'undefined') return null;

    return createPortal(
      <div
        className="fixed bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-200/50 py-2 min-w-[160px] z-[9999]"
        style={{ top: position.top, left: position.left }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {options.map((option) => (
          <button
            key={option}
            onClick={(e) => {
              e.preventDefault();
              onSelect(option);
              setShowDropdown(false);
            }}
            className={`w-full text-left px-4 py-2 text-sm transition-colors ${
              value === option 
                ? 'text-[#0D6EFD] bg-blue-50/80 font-medium' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50/80'
            }`}
          >
            {option}
          </button>
        ))}
      </div>,
      document.body
    );
  };

  return (
    <div className="flex h-16 w-full items-center justify-between rounded-[28px] border border-gray-200/50 bg-white/80 px-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl">
      <div className="flex items-center gap-4 flex-1">
        <button className="p-2 hover:bg-gray-100 rounded-full lg:hidden"><Menu size={20} /></button>
        
        <div className="flex-1 max-w-xl mr-2">
          <HeaderMenuSearch menuItems={menuItems} onNavigate={handleMenuSearchNavigate} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          ref={yearButtonRef}
          onClick={handleYearToggle}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200/50 bg-white hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
        >
          <GraduationCap size={16} className="text-gray-500" />
          <span className="max-w-[80px] truncate">{effectiveYear || '—'}</span>
          <ChevronDown size={14} className={`text-gray-400 transition-transform ${showYearDropdown ? 'rotate-180' : ''}`} />
        </button>

        <button
          ref={termButtonRef}
          onClick={handleTermToggle}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200/50 bg-white hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
        >
          <BookOpen size={16} className="text-gray-500" />
          
          <span className="max-w-[60px] truncate">{effectiveTerm || '—'}</span>
          <ChevronDown size={14} className={`text-gray-400 transition-transform ${showTermDropdown ? 'rotate-180' : ''}`} />
        </button>

        {renderDropdown(showYearDropdown, yearPosition, setSelectedYear, setShowYearDropdown, displayYears, effectiveYear)}
        {renderDropdown(showTermDropdown, termPosition, setSelectedTerm, setShowTermDropdown, displayTerms, effectiveTerm)}

        <button
          onClick={onToggleChatbot}
          className={`relative p-2 rounded-full transition-colors ${
            isChatbotOpen ? 'text-gray-600 bg-gray-100' : 'text-gray-500 hover:text-gray-600 hover:bg-gray-100'
          }`}
          title="Toggle Chatbot"
        >
          <div className="w-8 h-8 bg-gradient-to-br from-[#0D6EFD] to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
          <Bot size={16} />
        </div>
        </button>

        <div className="relative cursor-pointer">
          <Bell size={20} className="text-gray-600" />
          <div className="absolute -top-1 -right-1 bg-[#0D6EFD] text-white rounded-full w-4 h-4 text-[9px] flex items-center justify-center">3</div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-3 cursor-pointer" ref={userButtonRef} onClick={handleUserToggle}>
            {logoUrl ? (
              <LogoImage
                key={logoUrl}
                url={logoUrl}
                fallback={
                  <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-white bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700">
                    {user?.name?.charAt(0).toUpperCase() || 'S'}
                  </div>
                }
              />
            ) : (
              <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-white bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700">
                {user?.name?.charAt(0).toUpperCase() || 'S'}
              </div>
            )}
            <span className="font-medium text-sm flex items-center gap-1">
              {user?.name || 'Sarah Patel'}
              <ChevronDown size={14} className={`transition-transform ${showUserDropdown ? 'rotate-180' : ''}`} />
            </span>
          </div>
          
          </div>
        
        {showUserDropdown && userPosition && typeof document !== 'undefined' && createPortal(
          <div
            className="fixed z-[9999] max-w-[calc(100vw-24px)] overflow-x-auto rounded-2xl border bg-popover shadow-lg"
            style={{ top: userPosition.top, right: userPosition.right }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/*
              One panel, three columns, every item visible. The groups used to be
              rows that revealed a flyout on hover, which put three interactions
              between the avatar and a screen; laid out side by side they cost one.

              The cards below are the sidebar's Level 2 cards — same height, radius,
              border, icon chip and hover treatment — because these entries are peers
              of the ones in that panel, and a user who learns the shape there should
              not have to learn a second one here. Columns are a fixed 220px rather
              than a share of the panel: that is the width at which the longest label
              in the three lists still fits on one line. Below the sm breakpoint they
              stack, since three of them do not fit a phone at any useful width.
            */}
            <div className="grid max-h-[70vh] grid-cols-1 gap-x-3 gap-y-5 overflow-y-auto p-3 sm:grid-cols-[repeat(3,220px)]">
              {menuGroups.map((group) => {
                // Read out of the group before the closures below capture it, so
                // the optional href narrows to a string for the click handler.
                const groupHref = group.href;

                return (
                  <div key={group.label} className="min-w-0">
                    <div className="px-1 pb-2">
                      {groupHref ? (
                        <button
                          type="button"
                          onClick={() => { closeUserDropdown(); router.push(groupHref); }}
                          className="max-w-full truncate rounded-md text-left text-sm font-bold text-popover-foreground transition-colors hover:text-[#0D6EFD]"
                        >
                          {group.label}
                        </button>
                      ) : (
                        <span className="block truncate text-sm font-bold text-popover-foreground">
                          {group.label}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 border-t border-border pt-2">
                      {group.items.map((subItem) => {
                        const ItemIcon = group.icons[subItem];
                        const route = group.routes[subItem] || '/';

                        return (
                          <button
                            key={subItem}
                            type="button"
                            onClick={() => { closeUserDropdown(); router.push(route); }}
                            title={subItem}
                            className="h-10 w-full flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-left text-sm font-semibold text-muted-foreground shadow-xs transition-all cursor-pointer hover:border-muted-foreground/30 hover:bg-muted/60 hover:text-foreground hover:shadow-sm"
                          >
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                              {ItemIcon ? <ItemIcon size={15} /> : subItem.charAt(0).toUpperCase()}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{subItem}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-border p-2">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  logout();
                  closeUserDropdown();
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <LogOut size={15} />
                </span>
                Sign Out
              </button>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}
