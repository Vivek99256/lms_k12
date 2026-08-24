'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Search, ChevronDown, Menu, LogOut, GraduationCap, BookOpen, Bot } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

const profileMenuItems = [
  'Implementation',
  'Onboarding',
  'Add Process',
  'Fields Configuration',
  // 'Group-wise Rights',
  // 'Individual Rights',
  'Mobile App Rights',
] as const;

function readAcademicSession() {
  if (typeof window === 'undefined') return null;

  const storageKeys = ['userData', 'menuContext', 'auth', 'sessionData', 'sessiondata', 'user_data', 'session', 'academicSession', 'academicData'];
  for (const key of storageKeys) {
    const stored = localStorage.getItem(key);
    if (!stored) continue;
    try {
      const data = JSON.parse(stored);
      const terms: string[] = [];
      const years: string[] = [];

      if (Array.isArray(data.academicTerms)) {
        for (const item of data.academicTerms) {
          const syear = item.syear != null ? String(item.syear) : null;
          const termName =  item.title || null;
          if (syear && !years.includes(syear)) years.push(syear);
          if (termName && !terms.includes(termName)) terms.push(termName);
        }
      }

      if (Array.isArray(data.academicYears)) {
        for (const item of data.academicYears) {
          const syear = item.syear != null ? String(item.syear) : null;
          if (syear && !years.includes(syear)) years.push(syear);
        }
      }

      if (years.length > 0 || terms.length > 0) {
        console.log('[Header] academic session from key:', key, { years, terms });
        return {
          years: years.length > 0 ? years : [],
          terms: terms.length > 0 ? terms : [],
          selectedYear: years.length > 0 ? years[0] : '',
          selectedTerm: terms.length > 0 ? terms[0] : '',
        };
      }
    } catch {
      continue;
    }
  }
  return null;
}

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
  const { user, logout, refreshAcademicTerms } = useAuth();
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

  const [selectedYear, setSelectedYear] = useState<string>(() => {
    const stored = getStoredSelection('selectedAcademicYear');
    if (stored) return stored;
    const academic = readAcademicSession();
    return academic?.selectedYear || '';
  });

  const [selectedTerm, setSelectedTerm] = useState<string>(() => {
    const stored = getStoredSelection('selectedAcademicTerm');
    if (stored) return stored;
    const academic = readAcademicSession();
    return academic?.selectedTerm || 'Term 1';
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && selectedYear) {
      localStorage.setItem('selectedAcademicYear', selectedYear);
      localStorage.setItem('selectedAcademicTerm', selectedTerm);
    }
  }, [selectedYear, selectedTerm]);

  // `selectedYear` can still be empty on first render if login hasn't
  // populated the academic session yet — adopt the real syear as soon as
  // it shows up instead of staying blank (and leaving term dropdowns empty).
  useEffect(() => {
    if (selectedYear) return;
    const academic = readAcademicSession();
    if (academic?.selectedYear) setSelectedYear(academic.selectedYear);
  }, [user, selectedYear]);

  // Term dropdowns app-wide read `academicTerms`, which only ever comes
  // from login (scoped to that syear) — refetch it whenever the switcher
  // changes years, otherwise every term select goes empty for any other year.
  useEffect(() => {
    void refreshAcademicTerms(selectedYear);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]);

  const [yearPosition, setYearPosition] = useState<{ top: number; left: number } | null>(null);
  const [termPosition, setTermPosition] = useState<{ top: number; left: number } | null>(null);
  const [hasLogoError, setHasLogoError] = useState(false);

  const academic = readAcademicSession();
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
  const years = academic?.years && academic.years.length > 0 ? academic.years : ['2025', '2024', '2023'];
  const displayYears = !selectedYear || years.includes(selectedYear) ? years : [selectedYear, ...years];

  const terms = academic?.terms && academic.terms.length > 0 ? academic.terms : ['Term 1', 'Term 2', 'Term 3', 'Term 4'];
  const displayTerms = terms.includes(selectedTerm) ? terms : [selectedTerm, ...terms];

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
          <span className="max-w-[80px] truncate">{selectedYear}</span>
          <ChevronDown size={14} className={`text-gray-400 transition-transform ${showYearDropdown ? 'rotate-180' : ''}`} />
        </button>

        <button
          ref={termButtonRef}
          onClick={handleTermToggle}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200/50 bg-white hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
        >
          <BookOpen size={16} className="text-gray-500" />
          
          <span className="max-w-[60px] truncate">{selectedTerm}</span>
          <ChevronDown size={14} className={`text-gray-400 transition-transform ${showTermDropdown ? 'rotate-180' : ''}`} />
        </button>

        {renderDropdown(showYearDropdown, yearPosition, setSelectedYear, setShowYearDropdown, displayYears, selectedYear)}
        {renderDropdown(showTermDropdown, termPosition, setSelectedTerm, setShowTermDropdown, displayTerms, selectedTerm)}

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
