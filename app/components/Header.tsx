'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Search, ChevronDown, Menu, LogOut, GraduationCap, BookOpen, Bot } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

const profileMenuItems = [
  'Implementation',
  'Onboarding',
  'Add Process',
  'Fields Configuration',
  'Group-wise Rights',
  'Individual Rights',
  'Mobile App Rights',
] as const;

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
}: {
  onToggleChatbot: () => void;
  isChatbotOpen: boolean;
}) {
  const { user, logout, refreshAcademicTerms, academicTerms, academicYears } = useAuth();
  const router = useRouter();
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showTermDropdown, setShowTermDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [userPosition, setUserPosition] = useState<{ top: number; right: number } | null>(null);

  const menuRoutes: Record<string, string> = {
    'Implementation': '/general/implementation_management',
    'Onboarding': '/general/onboarding',
    'Add Process': '/general/add_process',
    'Fields Configuration': '/general/fields_configuration',
    'Group-wise Rights': '/general/groupwise_rights',
    'Individual Rights': '/general/individual_rights',
    'Mobile App Rights': '/general/mobile_app_rights',
  };

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
    if (effectiveYear) localStorage.setItem('selectedAcademicYear', effectiveYear);
    if (effectiveTerm) localStorage.setItem('selectedAcademicTerm', effectiveTerm);
  }, [effectiveYear, effectiveTerm]);

  useEffect(() => {
    void refreshAcademicTerms(effectiveYear);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveYear]);

  const [yearPosition, setYearPosition] = useState<{ top: number; left: number } | null>(null);
  const [termPosition, setTermPosition] = useState<{ top: number; left: number } | null>(null);
  const [hasLogoError, setHasLogoError] = useState(false);

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

  useEffect(() => {
    setHasLogoError(false);
  }, [logoUrl]);
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

  const handleUserToggle = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setUserPosition({
      top: rect.bottom + 8,
      right: Math.max(12, window.innerWidth - rect.right),
    });
    setShowUserDropdown(prev => !prev);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (yearButtonRef.current?.contains(target) || termButtonRef.current?.contains(target) || userButtonRef.current?.contains(target)) {
        return;
      }
      setShowYearDropdown(false);
      setShowTermDropdown(false);
      setShowUserDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
          <div className="search-bar flex items-center bg-white border border-gray-200 pl-5 pr-4 py-2 rounded-full">
            <Search size={18} className="text-gray-400 mr-3" />
            <input type="text" placeholder="Search for subjects, chapters, students..." className="flex-1 bg-transparent text-sm outline-none" />
          </div>
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
            {logoUrl && !hasLogoError ? (
              <img 
                src={logoUrl} 
                alt="Logo" 
                className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-white object-contain" 
                onError={() => {
                  setHasLogoError(true);
                }}
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
            className="fixed z-[9999] w-[210px] overflow-hidden rounded-xl border border-gray-200 bg-white py-1.5 shadow-xl"
            style={{ top: userPosition.top, right: userPosition.right }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {profileMenuItems.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => { setShowUserDropdown(false); router.push(menuRoutes[item] || '/'); }}
                className="w-full px-4 py-1.5 text-left text-[13px] leading-5 text-gray-600 transition-colors hover:bg-blue-50 hover:text-blue-700"
              >
                {item}
              </button>
            ))}
            <div className="my-1.5 border-t border-gray-100" />
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                logout();
                setShowUserDropdown(false);
              }}
              className="flex w-full items-center gap-2 px-4 py-1.5 text-left text-[13px] leading-5 text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}
