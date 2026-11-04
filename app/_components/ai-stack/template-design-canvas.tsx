'use client';

import React, { type CSSProperties } from 'react';
import {
  Sparkles,
  BookOpen,
  Monitor,
  FileText,
  Award,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Zap,
  Activity,
  Check,
  Compass,
  Flame,
  HelpCircle,
  Clock,
  Shield,
  Star,
  Terminal,
  Cpu,
  BarChart3,
  Bookmark,
  Scale,
  Flag,
  Crosshair,
} from 'lucide-react';

export interface ContentTemplateOption {
  id: string;
  name: string;
  tagline: string;
  badge: string;
  badgeColor: string;
  previewBg: string;
  previewBorder: string;
  previewAccent: string;
  previewText: string;
  paletteDot: string;
  description: string;
  supportedTypes: string[];
  // Complete Template Design Tokens:
  fontFamilyHeading: string;
  fontFamilyBody: string;
  slideBg: string;
  cardBg: string;
  textColor: string;
  headingColor: string;
  mutedColor: string;
  accentColor: string;
  borderColor: string;
  calloutBg: string;
  badgeBg: string;
  badgeTextColor: string;
  tableHeaderBg: string;
  accentGradient: string;
  patternType: 'dots' | 'parchment' | 'subtle' | 'blueprint' | 'none' | 'grid';
  heroCoverImg: string;
  visualHookImg: string;
  // Specific Layout & Aesthetic Personality Tokens:
  borderRadius: string;
  layoutVariant:
    | 'tech_glass'
    | 'academic_treatise'
    | 'playful_bento'
    | 'stem_schematic'
    | 'editorial_journal'
    | 'swiss_minimal'
    | 'infographic_flow'
    | 'rpg_quest';
  patternCss: string;
  signatureBadge: string;
  layoutTag: string;
}

export const CONTENT_TEMPLATES: ContentTemplateOption[] = [
  {
    id: 'modern_tech',
    name: 'Modern Slate & Neon',
    tagline: 'High-contrast dark slate with vivid indigo glow & neon highlights',
    badge: 'Tech & Sleek',
    badgeColor: 'bg-indigo-950/70 text-indigo-300 border-indigo-700/60',
    previewBg: '#0b0f19',
    previewBorder: 'border-indigo-500/40',
    previewAccent: '#6366f1',
    previewText: '#f8fafc',
    paletteDot: '#6366f1',
    description: 'Dark indigo cards with glowing concept badges, high-contrast typography, and crisp SVG vector diagrams. Ideal for modern digital classrooms.',
    supportedTypes: ['PPT', 'PDF', 'Notes', 'Activity', 'Assessment'],
    fontFamilyHeading: "'Plus Jakarta Sans', system-ui, sans-serif",
    fontFamilyBody: "'Plus Jakarta Sans', system-ui, sans-serif",
    slideBg: '#0b0f19',
    cardBg: '#111827',
    textColor: '#f8fafc',
    headingColor: '#ffffff',
    mutedColor: '#94a3b8',
    accentColor: '#6366f1',
    borderColor: 'rgba(99, 102, 241, 0.35)',
    calloutBg: 'rgba(30, 41, 59, 0.8)',
    badgeBg: 'rgba(99, 102, 241, 0.25)',
    badgeTextColor: '#a5b4fc',
    tableHeaderBg: '#1e293b',
    accentGradient: 'from-indigo-600 via-violet-600 to-cyan-500',
    patternType: 'dots',
    heroCoverImg: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
    visualHookImg: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80',
    borderRadius: '16px',
    layoutVariant: 'tech_glass',
    patternCss: 'radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.22) 0%, transparent 65%)',
    signatureBadge: '⚡ CYBER-DECK 4.0',
    layoutTag: 'Glassmorphism Bento Deck',
  },
  {
    id: 'academic_classic',
    name: 'Academic Classic (CBSE)',
    tagline: 'Warm ivory parchment with Oxford navy & serif headers',
    badge: 'Curriculum & CBSE',
    badgeColor: 'bg-amber-100 text-blue-950 border-amber-300',
    previewBg: '#fbfaf8',
    previewBorder: 'border-amber-300/80',
    previewAccent: '#1e3a8a',
    previewText: '#0f172a',
    paletteDot: '#1e3a8a',
    description: 'Structured formal layout with warm ivory background, classic serif headers, crimson warnings, and aligned textbook tables.',
    supportedTypes: ['PPT', 'PDF', 'Notes', 'Activity', 'Assessment'],
    fontFamilyHeading: "'Merriweather', Georgia, serif",
    fontFamilyBody: "'Plus Jakarta Sans', system-ui, sans-serif",
    slideBg: '#faf7f0',
    cardBg: '#ffffff',
    textColor: '#0f172a',
    headingColor: '#1e3a8a',
    mutedColor: '#475569',
    accentColor: '#1e3a8a',
    borderColor: '#cbd5e1',
    calloutBg: '#f8fafc',
    badgeBg: '#e0e7ff',
    badgeTextColor: '#1e3a8a',
    tableHeaderBg: '#f1f5f9',
    accentGradient: 'from-blue-900 via-indigo-900 to-rose-900',
    patternType: 'parchment',
    heroCoverImg: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=800&q=80',
    visualHookImg: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=800&q=80',
    borderRadius: '8px',
    layoutVariant: 'academic_treatise',
    patternCss: 'radial-gradient(#e2e8f0 1px, transparent 1px)',
    signatureBadge: '🏛️ CBSE CURRICULUM SYLLABUS',
    layoutTag: 'Classic Textbook & Treatise',
  },
  {
    id: 'vibrant_creative',
    name: 'Vibrant & Creative',
    tagline: 'Soft mint, coral amber & playful student-friendly visual tiles',
    badge: 'Student Friendly',
    badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    previewBg: '#f0fdf4',
    previewBorder: 'border-emerald-300',
    previewAccent: '#059669',
    previewText: '#064e3b',
    paletteDot: '#059669',
    description: 'Warm and inviting layout featuring friendly rounded cards, encouraging prompts, real-world analogies, and engaging student activities.',
    supportedTypes: ['PPT', 'PDF', 'Notes', 'Activity', 'Assessment'],
    fontFamilyHeading: "'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif",
    fontFamilyBody: "'Plus Jakarta Sans', system-ui, sans-serif",
    slideBg: '#f0fdf4',
    cardBg: '#ffffff',
    textColor: '#064e3b',
    headingColor: '#047857',
    mutedColor: '#374151',
    accentColor: '#059669',
    borderColor: '#bbf7d0',
    calloutBg: '#ecfdf5',
    badgeBg: '#dcfce7',
    badgeTextColor: '#065f46',
    tableHeaderBg: '#d1fae5',
    accentGradient: 'from-emerald-500 via-teal-500 to-amber-500',
    patternType: 'subtle',
    heroCoverImg: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=800&q=80',
    visualHookImg: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=800&q=80',
    borderRadius: '24px',
    layoutVariant: 'playful_bento',
    patternCss: 'radial-gradient(#a7f3d0 1.5px, transparent 1.5px)',
    signatureBadge: '💡 STUDENT-FRIENDLY DISCOVERY',
    layoutTag: 'Playful Bento Grid & Sticky Notes',
  },
  {
    id: 'stem_blueprint',
    name: 'STEM Technical Blueprint',
    tagline: 'Deep navy engineering grid with cyan & monospace formulas',
    badge: 'Formulas & Precision',
    badgeColor: 'bg-cyan-950 text-cyan-300 border-cyan-800',
    previewBg: '#031826',
    previewBorder: 'border-cyan-500/50',
    previewAccent: '#06b6d4',
    previewText: '#e0f2fe',
    paletteDot: '#06b6d4',
    description: 'Technical engineering grid styling with formula blocks, precision vector graphs, and analytical data charts.',
    supportedTypes: ['PPT', 'PDF', 'Notes', 'Activity', 'Assessment'],
    fontFamilyHeading: "'JetBrains Mono', monospace",
    fontFamilyBody: "'Plus Jakarta Sans', system-ui, sans-serif",
    slideBg: '#031826',
    cardBg: '#072538',
    textColor: '#e0f2fe',
    headingColor: '#38bdf8',
    mutedColor: '#94a3b8',
    accentColor: '#06b6d4',
    borderColor: 'rgba(6, 182, 212, 0.4)',
    calloutBg: 'rgba(8, 51, 68, 0.7)',
    badgeBg: 'rgba(6, 182, 212, 0.2)',
    badgeTextColor: '#67e8f9',
    tableHeaderBg: '#0c4a6e',
    accentGradient: 'from-cyan-500 via-teal-500 to-emerald-400',
    patternType: 'blueprint',
    heroCoverImg: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=800&q=80',
    visualHookImg: 'https://images.unsplash.com/photo-1507668077129-56e32842fceb?auto=format&fit=crop&w=800&q=80',
    borderRadius: '6px',
    layoutVariant: 'stem_schematic',
    patternCss: 'linear-gradient(rgba(6,182,212,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.15) 1px, transparent 1px)',
    signatureBadge: '📐 ISO-STEM CAD TELEMETRY',
    layoutTag: 'Technical Telemetry & Formula CAD',
  },
  {
    id: 'warm_editorial',
    name: 'Humanities & Warm Editorial',
    tagline: 'Warm terracotta, sand & espresso with elegant editorial serif typography',
    badge: 'Humanities & Literature',
    badgeColor: 'bg-orange-50 text-orange-900 border-orange-200',
    previewBg: '#fcfaf7',
    previewBorder: 'border-orange-200',
    previewAccent: '#c2410c',
    previewText: '#292524',
    paletteDot: '#c2410c',
    description: 'Magazine editorial aesthetics with warm sand tones, pull quotes, rich cultural/historical imagery, and narrative depth.',
    supportedTypes: ['PPT', 'PDF', 'Notes', 'Activity', 'Assessment'],
    fontFamilyHeading: "'Playfair Display', Georgia, serif",
    fontFamilyBody: "'Plus Jakarta Sans', system-ui, sans-serif",
    slideBg: '#fcfaf7',
    cardBg: '#ffffff',
    textColor: '#292524',
    headingColor: '#9a3412',
    mutedColor: '#78716c',
    accentColor: '#c2410c',
    borderColor: '#e7e5e4',
    calloutBg: '#fff7ed',
    badgeBg: '#ffedd5',
    badgeTextColor: '#9a3412',
    tableHeaderBg: '#fed7aa',
    accentGradient: 'from-amber-700 via-orange-600 to-rose-700',
    patternType: 'subtle',
    heroCoverImg: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=800&q=80',
    visualHookImg: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=800&q=80',
    borderRadius: '12px',
    layoutVariant: 'editorial_journal',
    patternCss: 'radial-gradient(#fed7aa 1px, transparent 1px)',
    signatureBadge: '📖 THE ACADEMIC OBSERVER',
    layoutTag: 'Editorial Spread & Drop-Caps',
  },
  {
    id: 'minimalist_clean',
    name: 'Minimalist Executive',
    tagline: 'Pure white canvas with sharp obsidian typography and cobalt focus',
    badge: 'Swiss & Clarity',
    badgeColor: 'bg-slate-100 text-slate-900 border-slate-300',
    previewBg: '#ffffff',
    previewBorder: 'border-slate-300',
    previewAccent: '#2563eb',
    previewText: '#0f172a',
    paletteDot: '#2563eb',
    description: 'Generous whitespace, razor-sharp 1px borders, bold weight contrasts, and distraction-free cognitive clarity.',
    supportedTypes: ['PPT', 'PDF', 'Notes', 'Activity', 'Assessment'],
    fontFamilyHeading: "'Inter', system-ui, sans-serif",
    fontFamilyBody: "'Inter', system-ui, sans-serif",
    slideBg: '#ffffff',
    cardBg: '#f8fafc',
    textColor: '#0f172a',
    headingColor: '#0f172a',
    mutedColor: '#64748b',
    accentColor: '#2563eb',
    borderColor: '#e2e8f0',
    calloutBg: '#f1f5f9',
    badgeBg: '#e0e7ff',
    badgeTextColor: '#1d4ed8',
    tableHeaderBg: '#f8fafc',
    accentGradient: 'from-blue-600 via-slate-800 to-black',
    patternType: 'none',
    heroCoverImg: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80',
    visualHookImg: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=800&q=80',
    borderRadius: '4px',
    layoutVariant: 'swiss_minimal',
    patternCss: 'none',
    signatureBadge: '◻ SWISS INTERNATIONAL STYLE',
    layoutTag: 'Asymmetric Executive Grid',
  },
  {
    id: 'infographic_visual',
    name: 'Infographic & Visual Flow',
    tagline: 'High-contrast diagram-first layout with step sequences and metric tiles',
    badge: 'Visual & Infographic',
    badgeColor: 'bg-sky-950 text-sky-300 border-sky-700',
    previewBg: '#060b19',
    previewBorder: 'border-sky-500/40',
    previewAccent: '#00b4d8',
    previewText: '#f8fafc',
    paletteDot: '#00b4d8',
    description: 'Visual learner-calibrated design featuring multi-step sequence cards, visual statistics, and prominent concept diagrams.',
    supportedTypes: ['PPT', 'PDF', 'Notes', 'Activity', 'Assessment'],
    fontFamilyHeading: "'Plus Jakarta Sans', system-ui, sans-serif",
    fontFamilyBody: "'Plus Jakarta Sans', system-ui, sans-serif",
    slideBg: '#060b19',
    cardBg: '#0d162e',
    textColor: '#f8fafc',
    headingColor: '#38bdf8',
    mutedColor: '#94a3b8',
    accentColor: '#00b4d8',
    borderColor: 'rgba(0, 180, 216, 0.4)',
    calloutBg: 'rgba(16, 31, 66, 0.8)',
    badgeBg: 'rgba(0, 180, 216, 0.2)',
    badgeTextColor: '#7dd3fc',
    tableHeaderBg: '#101f42',
    accentGradient: 'from-sky-400 via-blue-500 to-fuchsia-500',
    patternType: 'grid',
    heroCoverImg: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80',
    visualHookImg: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80',
    borderRadius: '14px',
    layoutVariant: 'infographic_flow',
    patternCss: 'radial-gradient(circle at 100% 100%, rgba(0, 180, 216, 0.2) 0%, transparent 60%)',
    signatureBadge: '📊 INFOGRAPHIC MILESTONE FLOW',
    layoutTag: 'Visual Step Pipeline & KPI Cards',
  },
  {
    id: 'gamified_quest',
    name: 'Gamified Quest & Discovery',
    tagline: 'Cosmic purple with golden XP badges, mission cards & achievement checkpoints',
    badge: 'Quest & Discovery',
    badgeColor: 'bg-purple-950 text-amber-300 border-purple-700',
    previewBg: '#110722',
    previewBorder: 'border-purple-600/40',
    previewAccent: '#a855f7',
    previewText: '#fdf4ff',
    paletteDot: '#a855f7',
    description: 'High student engagement with mission challenge containers, gold achievement badges, and interactive step markers.',
    supportedTypes: ['PPT', 'PDF', 'Notes', 'Activity', 'Assessment'],
    fontFamilyHeading: "'Fredoka', 'Outfit', sans-serif",
    fontFamilyBody: "'Plus Jakarta Sans', system-ui, sans-serif",
    slideBg: '#110722',
    cardBg: '#1d0f38',
    textColor: '#fdf4ff',
    headingColor: '#facc15',
    mutedColor: '#d8b4fe',
    accentColor: '#a855f7',
    borderColor: 'rgba(168, 85, 247, 0.4)',
    calloutBg: 'rgba(46, 16, 85, 0.8)',
    badgeBg: 'rgba(250, 204, 21, 0.15)',
    badgeTextColor: '#fde047',
    tableHeaderBg: '#2e1065',
    accentGradient: 'from-amber-400 via-purple-500 to-indigo-500',
    patternType: 'dots',
    heroCoverImg: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=800&q=80',
    visualHookImg: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80',
    borderRadius: '20px',
    layoutVariant: 'rpg_quest',
    patternCss: 'radial-gradient(circle at 50% 0%, rgba(168, 85, 247, 0.28) 0%, transparent 70%)',
    signatureBadge: '⚔️ RPG QUEST SYSTEM',
    layoutTag: 'Gamified Quest Log & Boss Battle',
  },
];

export interface TemplateDesignCanvasProps {
  template: ContentTemplateOption;
  mode: 'ppt' | 'pdf';
  slideIdx: number;
  standardName: string;
  subjectName: string;
  chapterName: string;
  teachingApproach: string;
  isFullscreen?: boolean;
}

// =============================================================================
// SHARED VECTOR DIAGRAM COMPONENT (DYNAMIC PER THEME)
// =============================================================================
function DynamicMarketVectorDiagram({ template }: { template: ContentTemplateOption }) {
  const isDark = ['modern_tech', 'stem_blueprint', 'infographic_visual', 'gamified_quest'].includes(template.id);
  const axisColor = isDark ? '#94a3b8' : '#475569';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  return (
    <svg viewBox="0 0 420 200" className="w-full h-auto">
      {/* Background Grids */}
      {template.id === 'stem_blueprint' && (
        <defs>
          <pattern id="stemGridCanvas" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(6,182,212,0.18)" strokeWidth="0.8" />
          </pattern>
        </defs>
      )}
      {template.id === 'stem_blueprint' && (
        <rect x="40" y="20" width="340" height="140" fill="url(#stemGridCanvas)" />
      )}

      {/* Academic Shaded Surplus Regions */}
      {template.id === 'academic_classic' && (
        <>
          <polygon points="40,40 210,90 40,90" fill="rgba(30, 58, 138, 0.08)" />
          <polygon points="40,90 210,90 40,140" fill="rgba(136, 19, 55, 0.08)" />
          <text x="50" y="70" fill="#1e3a8a" fontSize="9" fontStyle="italic">Consumer Surplus Area</text>
          <text x="50" y="115" fill="#881337" fontSize="9" fontStyle="italic">Producer Surplus Area</text>
        </>
      )}

      {/* Axes */}
      <line x1="40" y1="20" x2="40" y2="160" stroke={axisColor} strokeWidth="1.5" />
      <line x1="40" y1="160" x2="380" y2="160" stroke={axisColor} strokeWidth="1.5" />

      <text x="12" y="30" fill={axisColor} fontSize="10" fontWeight="700">Price (P)</text>
      <text x="320" y="180" fill={axisColor} fontSize="10" fontWeight="700">Quantity (Q)</text>

      {/* Demand Curve */}
      <line x1="70" y1="40" x2="350" y2="140" stroke="#f43f5e" strokeWidth={template.id === 'minimalist_clean' ? '2' : '3'} strokeLinecap="round" />
      <text x="355" y="145" fill="#f43f5e" fontSize="11" fontWeight="800">D (Demand)</text>

      {/* Supply Curve */}
      <line x1="70" y1="140" x2="350" y2="40" stroke="#10b981" strokeWidth={template.id === 'minimalist_clean' ? '2' : '3'} strokeLinecap="round" />
      <text x="355" y="45" fill="#10b981" fontSize="11" fontWeight="800">S (Supply)</text>

      {/* Equilibrium Point */}
      <circle cx="210" cy="90" r="10" fill={template.accentColor} fillOpacity="0.25" />
      <circle cx="210" cy="90" r="4" fill={template.accentColor} stroke="#ffffff" strokeWidth="1.5" />

      <line x1="40" y1="90" x2="210" y2="90" stroke={template.accentColor} strokeWidth="1.2" strokeDasharray="3,3" />
      <line x1="210" y1="90" x2="210" y2="160" stroke={template.accentColor} strokeWidth="1.2" strokeDasharray="3,3" />

      <text x="220" y="86" fill={template.headingColor} fontSize="11" fontWeight="800">
        Equilibrium E (P*, Q*)
      </text>
    </svg>
  );
}

// =============================================================================
// 1. MODERN TECH PPT SLIDE (Bento Deck / Cyber Glass)
// =============================================================================
function ModernTechSlide({
  slideIdx,
  standardName,
  subjectName,
  chapterName,
  teachingApproach,
  template,
}: TemplateDesignCanvasProps) {
  return (
    <div className="h-full flex flex-col justify-between relative text-slate-100">
      <div className="absolute -top-4 -left-4 -right-4 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400" />
      
      {/* Top Cyber Telemetry Bar */}
      <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
        <div className="flex items-center gap-2">
          <span className="bg-indigo-950/80 text-indigo-300 border border-indigo-600/40 text-[10px] font-mono px-2 py-0.5 rounded flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-cyan-400 animate-pulse" />
            SYS_ONLINE • v4.2
          </span>
          <span className="text-[11px] font-semibold text-slate-400">
            {standardName} // {subjectName}
          </span>
        </div>
        <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">
          ⚡ CYBER-BENTO SLIDE {slideIdx + 1}/4
        </span>
      </div>

      {/* Main Slide Stage */}
      <div className="my-auto py-2">
        {slideIdx === 0 && (
          <div className="space-y-4">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-400">
                [ARCHITECTURE DECK] • {teachingApproach}
              </span>
              <h1 className="text-3xl font-extrabold text-white tracking-tight mt-0.5">
                {chapterName}
              </h1>
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                Microservice concept deconstruction, quantitative equilibrium models, and automated market simulations.
              </p>
            </div>

            {/* 3 Modular Bento Cards */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { code: 'AXIOM_01', title: 'Law of Demand', desc: 'Inverse price elasticity and utility contraction.' },
                { code: 'AXIOM_02', title: 'Dynamic Equilibrium', desc: 'Real-time vector convergence between supply and demand.' },
                { code: 'AXIOM_03', title: 'Market Simulation', desc: 'Policy intervention and price ceiling stress tests.' },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="bg-slate-900/80 border border-indigo-500/30 rounded-xl p-3 relative overflow-hidden backdrop-blur-md shadow-lg"
                >
                  <div className="absolute top-0 right-0 w-12 h-12 bg-indigo-500/10 rounded-bl-full" />
                  <span className="text-[9px] font-mono text-indigo-400 font-bold block">{item.code}</span>
                  <h4 className="text-xs font-bold text-white mt-1">{item.title}</h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {slideIdx === 1 && (
          <div className="grid grid-cols-2 gap-4 items-center">
            <div className="space-y-2.5">
              <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">
                STAGE_01 // SENSOR HOOK
              </span>
              <h3 className="text-lg font-bold text-white">The Observable Marketplace Paradox</h3>
              <div className="bg-slate-900/90 border border-indigo-500/30 rounded-xl p-3 font-mono text-xs text-slate-300 space-y-1.5">
                <div className="text-indigo-400 text-[10px]">// REAL_TIME_CASE_SCENARIO:</div>
                <p className="leading-relaxed">
                  During an extreme summer heatwave, demand spikes 400%. Inventory exhausts in hours; wholesale clearing prices double.
                </p>
                <div className="border-t border-slate-800 pt-1 text-[11px] text-amber-400">
                  ⚡ PARADOX: Unit production cost remained constant. Why did clearing price rise?
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-indigo-500/40 overflow-hidden relative shadow-xl">
              <img src={template.visualHookImg} alt="Hook" className="w-full h-36 object-cover" />
              <div className="bg-slate-950/90 p-2 text-[10px] font-mono text-indigo-300 border-t border-indigo-500/30 flex justify-between">
                <span>[SENSOR FEED: ACTIVE]</span>
                <span className="text-cyan-400">CALIBRATED</span>
              </div>
            </div>
          </div>
        )}

        {slideIdx === 2 && (
          <div className="grid grid-cols-2 gap-4 items-center">
            <div className="space-y-2">
              <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest">
                STAGE_02 // SYSTEM SCHEMATIC
              </span>
              <h3 className="text-lg font-bold text-white">Dynamic Market Clearance</h3>
              <div className="bg-slate-900/80 border-l-2 border-indigo-500 p-2.5 rounded-r-lg text-xs text-slate-300">
                Convergence vector where quantity demanded (Qd) perfectly clears quantity supplied (Qs).
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                <div className="p-2 bg-slate-900/60 border border-slate-800 rounded">
                  <span className="text-rose-400 block font-bold">P ↑ ⇒ Qd ↓</span>
                  <span className="text-slate-500">Demand Contraction</span>
                </div>
                <div className="p-2 bg-slate-900/60 border border-slate-800 rounded">
                  <span className="text-emerald-400 block font-bold">P ↑ ⇒ Qs ↑</span>
                  <span className="text-slate-500">Supply Expansion</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/80 border border-indigo-500/30 rounded-xl p-3 shadow-xl">
              <DynamicMarketVectorDiagram template={template} />
            </div>
          </div>
        )}

        {slideIdx === 3 && (
          <div className="grid grid-cols-2 gap-4 items-center">
            <div className="bg-slate-900/90 border border-indigo-500/30 rounded-xl p-3 space-y-2">
              <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider block">
                SIMULATION // PRICE CEILING CONTROL
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">
                Legal cap set at ₹70/unit while market clearing equilibrium is ₹110/unit.
              </p>
              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono pt-1">
                <div className="bg-slate-950 p-2 rounded border border-rose-500/30 text-rose-300">
                  STATUS: CHRONIC SHORTAGE
                </div>
                <div className="bg-slate-950 p-2 rounded border border-amber-500/30 text-amber-300">
                  IMPACT: BLACK MARKET
                </div>
              </div>
            </div>

            <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-3 space-y-2">
              <span className="text-[10px] font-mono text-cyan-300 font-bold uppercase tracking-wider">
                CORE SYSTEM TAKEAWAYS
              </span>
              <ul className="text-xs space-y-1 text-slate-300">
                <li>• Qd is driven by consumer marginal utility.</li>
                <li>• Qs is driven by producer margin incentive.</li>
                <li>• Market equilibrium clears excess inventory automatically.</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-indigo-500/20 pt-2 flex justify-between text-[10px] font-mono text-slate-500">
        <span>DEV-SPEC-DECK // SLATE-NEON</span>
        <span>MODULAR COMPONENT ARCHITECTURE</span>
      </div>
    </div>
  );
}

// =============================================================================
// 2. ACADEMIC CLASSIC PPT SLIDE (CBSE / Formal Oxford Textbook)
// =============================================================================
function AcademicClassicSlide({
  slideIdx,
  standardName,
  subjectName,
  chapterName,
  teachingApproach,
  template,
}: TemplateDesignCanvasProps) {
  return (
    <div className="h-full flex flex-col justify-between text-slate-900 font-serif relative">
      {/* Double Archival Border Frame */}
      <div className="absolute inset-0 border-4 border-double border-blue-950/30 pointer-events-none rounded" />

      {/* Classical Running Head */}
      <div className="border-b-2 border-blue-950/20 pb-1.5 flex items-center justify-between text-[11px] text-blue-950 font-bold tracking-widest uppercase">
        <div className="flex items-center gap-2">
          <span>🏛️ CENTRAL BOARD OF SECONDARY EDUCATION</span>
          <span className="text-slate-400">•</span>
          <span>{standardName} // {subjectName}</span>
        </div>
        <span className="font-mono text-[10px]">SECTION {slideIdx + 1}.0</span>
      </div>

      {/* Classical Slide Stage */}
      <div className="my-auto py-2">
        {slideIdx === 0 && (
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-[10px] font-bold tracking-widest text-blue-900 uppercase">
              CURRICULAR MONOGRAPH • {teachingApproach}
            </span>
            <div className="border-y-2 border-blue-900/30 py-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-blue-950 font-serif">
                {chapterName}
              </h1>
            </div>
            <p className="text-xs text-slate-600 italic">
              A Systematic Treatise on Foundational Laws, Empirical Equilibrium Models &amp; Real-World Policy Dilemmas.
            </p>

            {/* Classical Two-Column Syllabus Ledger */}
            <div className="border border-blue-900/20 bg-white p-3 text-left shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-900 border-b border-blue-900/20 pb-1 mb-2">
                Axiomatic Learning Intentions (Board Aligned)
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="flex gap-2">
                  <span className="font-bold text-blue-900 font-mono">§ I.</span>
                  <p className="text-[11px] text-slate-800 leading-snug">
                    Deconstruct foundational mechanisms governing Demand &amp; Consumer Utility.
                  </p>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold text-blue-900 font-mono">§ II.</span>
                  <p className="text-[11px] text-slate-800 leading-snug">
                    Examine graphical convergence and mathematical clearing price (*P\**).
                  </p>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold text-blue-900 font-mono">§ III.</span>
                  <p className="text-[11px] text-slate-800 leading-snug">
                    Solve Board Examination numerical problems and policy distortions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {slideIdx === 1 && (
          <div className="grid grid-cols-2 gap-5 items-center">
            <div className="space-y-2">
              <span className="text-[10px] font-mono text-blue-900 uppercase font-bold">
                ARTICLE I • INTRODUCTORY PROVOCATION
              </span>
              <h3 className="text-lg font-bold text-blue-950 font-serif">
                The Empirical Market Phenomenon
              </h3>
              <p className="text-xs leading-relaxed text-slate-700">
                <span className="text-2xl float-left font-bold text-blue-900 leading-none mr-1.5 font-serif">
                  D
                </span>
                uring acute seasonal heat anomalies, consumer beverage demand exhibits exponential expansion. Kiosks exhaust stock prior to midday, precipitating immediate wholesale price elevation.
              </p>
              <div className="border border-blue-900/30 bg-blue-50/50 p-2 text-[11px] text-blue-950 italic">
                <strong>Theorem Question:</strong> If marginal production cost was stationary, which foundational economic axiom necessitated price escalation?
              </div>
            </div>

            <div className="border-2 border-slate-300 p-1 bg-white shadow-sm">
              <img src={template.visualHookImg} alt="Plate 1" className="w-full h-36 object-cover" />
              <div className="text-[10px] text-center italic text-slate-600 mt-1 border-t pt-0.5">
                Plate 1.1: Empirical Economic Exchange in Open Market (CBSE Archive)
              </div>
            </div>
          </div>
        )}

        {slideIdx === 2 && (
          <div className="grid grid-cols-2 gap-4 items-center">
            <div className="space-y-2">
              <span className="text-[10px] font-mono text-blue-900 uppercase font-bold">
                ARTICLE II • MATHEMATICAL PROOF
              </span>
              <h3 className="text-lg font-bold text-blue-950 font-serif">
                Market Equilibrium Proof
              </h3>
              <div className="border-2 border-blue-950/20 bg-amber-50/30 p-2.5 text-xs text-slate-800">
                <strong>Axiom of Clearance:</strong> The price *P\** where aggregate demand equals aggregate supply (*Qd = Qs*), eliminating excess inventory.
              </div>
              <ul className="text-xs space-y-1 list-disc list-inside text-slate-700">
                <li>*Ceteris Paribus*: All non-price determinants held invariant.</li>
                <li>Substitution Effect: Consumer reallocation toward alternatives.</li>
              </ul>
            </div>

            <div className="border border-blue-950/20 p-2 bg-white">
              <DynamicMarketVectorDiagram template={template} />
            </div>
          </div>
        )}

        {slideIdx === 3 && (
          <div className="grid grid-cols-2 gap-4 items-center">
            <div className="border border-blue-900/30 p-3 bg-white space-y-1.5">
              <span className="text-[10px] font-bold text-blue-900 uppercase font-mono">
                BOARD EXAMINATION PROBLEM [3 MARKS]
              </span>
              <p className="text-xs text-slate-800">
                Explain the systemic consequences when state authorities mandate an artificial ceiling price below equilibrium *P\**.
              </p>
              <div className="border-t border-slate-200 pt-1 text-[11px] text-slate-600 italic">
                Rubric: (a) Chronic Shortage (1m), (b) Non-price rationing (1m), (c) Parallel market formation (1m).
              </div>
            </div>

            <div className="border-2 border-rose-900/30 bg-rose-50/40 p-3 space-y-1">
              <span className="text-[10px] font-bold text-rose-900 uppercase">
                ⚠️ NCERT EXAMINER CAUTION
              </span>
              <p className="text-xs text-slate-800 leading-snug">
                Never confuse an *extension in quantity demanded* with an *increase in demand*. Price alterations induce movement along the curve, not a curve shift.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Classical Running Foot */}
      <div className="border-t-2 border-blue-950/20 pt-1.5 flex justify-between text-[10px] text-slate-600">
        <span>CBSE TEXTBOOK CURRICULUM SYLLABUS SERIES</span>
        <span>OXFORD / CAMBRIDGE TREATISE FORMAT</span>
      </div>
    </div>
  );
}

// =============================================================================
// 3. VIBRANT CREATIVE PPT SLIDE (Playful Bento & Sticky Notes)
// =============================================================================
function VibrantCreativeSlide({
  slideIdx,
  standardName,
  subjectName,
  chapterName,
  teachingApproach,
  template,
}: TemplateDesignCanvasProps) {
  return (
    <div className="h-full flex flex-col justify-between text-emerald-950 font-sans relative">
      {/* Cheerful Top Bar with Rounded Badges */}
      <div className="flex items-center justify-between border-b-2 border-emerald-200 pb-2">
        <div className="flex items-center gap-2">
          <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-xs">
            <span>🎈</span> {standardName} • {subjectName}
          </span>
          <span className="text-xs font-semibold text-emerald-700 hidden sm:inline">
            Interactive Classroom Adventure
          </span>
        </div>
        <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
          Slide {slideIdx + 1} of 4
        </span>
      </div>

      {/* Main Playful Stage */}
      <div className="my-auto py-2">
        {slideIdx === 0 && (
          <div className="space-y-3.5">
            <div>
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">
                🌟 Classroom Discovery Mission • {teachingApproach}
              </span>
              <h1 className="text-3xl font-extrabold text-emerald-900 tracking-tight mt-0.5 font-outfit">
                {chapterName}
              </h1>
              <p className="text-xs text-emerald-800 mt-1 max-w-xl">
                Get ready to explore how everyday prices work, solve the mystery of market forces, and team up for interactive challenges!
              </p>
            </div>

            {/* 3 Staggered Colorful Sticky Notes */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-3 shadow-sm transform -rotate-1 hover:rotate-0 transition">
                <span className="text-base">📌</span>
                <h4 className="text-xs font-bold text-emerald-900 mt-0.5">Mystery #1: The Buyer</h4>
                <p className="text-[11px] text-emerald-800 mt-1">
                  Why do we buy more when prices fall, and pause when prices soar?
                </p>
              </div>

              <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-3 shadow-sm transform rotate-1 hover:rotate-0 transition">
                <span className="text-base">💡</span>
                <h4 className="text-xs font-bold text-amber-900 mt-0.5">Mystery #2: The Seller</h4>
                <p className="text-[11px] text-amber-800 mt-1">
                  What makes suppliers rush to make more goods when profits shine?
                </p>
              </div>

              <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-3 shadow-sm transform -rotate-1 hover:rotate-0 transition">
                <span className="text-base">🎯</span>
                <h4 className="text-xs font-bold text-rose-900 mt-0.5">Mystery #3: The Balance</h4>
                <p className="text-[11px] text-rose-800 mt-1">
                  How do buyers and sellers magically agree on a fair everyday price?
                </p>
              </div>
            </div>
          </div>
        )}

        {slideIdx === 1 && (
          <div className="grid grid-cols-2 gap-4 items-center">
            <div className="bg-white border-2 border-emerald-200 rounded-2xl p-3.5 shadow-sm space-y-2">
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                🔍 Everyday Mystery Hook
              </span>
              <h3 className="text-base font-bold text-emerald-950">The Summer Lemonade Mystery!</h3>
              <p className="text-xs text-slate-700 leading-relaxed">
                Imagine a scorching hot day at school. Everyone runs to the juice kiosk at noon. The stall runs out of cups in 15 minutes!
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-2 text-[11px] text-amber-900 font-semibold">
                🤔 If lemons cost the exact same as yesterday, why did the seller raise the glass price from ₹10 to ₹20?
              </div>
            </div>

            <div className="rounded-2xl border-2 border-emerald-300 overflow-hidden shadow-md transform rotate-1">
              <img src={template.visualHookImg} alt="Visual Hook" className="w-full h-36 object-cover" />
              <div className="bg-emerald-100/80 p-1.5 text-center text-[10px] font-bold text-emerald-800">
                📸 Real World Anchor: The Thirsty Crowd
              </div>
            </div>
          </div>
        )}

        {slideIdx === 2 && (
          <div className="grid grid-cols-2 gap-4 items-center">
            <div className="space-y-2">
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                📊 The Balance Point
              </span>
              <h3 className="text-base font-bold text-emerald-950">Where Buyer &amp; Seller Agree!</h3>
              <p className="text-xs text-emerald-900">
                Notice where the red Demand line and green Supply line cross? That magic crosshair is our <strong>Equilibrium</strong>!
              </p>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2 text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-800 font-semibold">
                  <span>✅</span> No leftover stock (Zero Waste)
                </div>
                <div className="flex items-center gap-1.5 text-emerald-800 font-semibold">
                  <span>✅</span> No disappointed shoppers (Zero Shortage)
                </div>
              </div>
            </div>

            <div className="bg-white border-2 border-emerald-200 rounded-2xl p-2.5 shadow-sm">
              <DynamicMarketVectorDiagram template={template} />
            </div>
          </div>
        )}

        {slideIdx === 3 && (
          <div className="grid grid-cols-2 gap-4 items-center">
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-3 space-y-1.5">
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                ⚡ Team Quest: Price Cap Dilemma
              </span>
              <p className="text-xs text-amber-950">
                What happens if the government makes a law: <em>"Lemonade must be sold at ₹5 maximum!"</em>
              </p>
              <div className="text-[11px] text-amber-900 bg-white/80 p-2 rounded-xl border border-amber-200">
                👉 Sellers refuse to sell; lines grow around the block!
              </div>
            </div>

            <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-3 space-y-1.5">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                🎉 Golden Explorer Badges
              </span>
              <ul className="text-xs space-y-1 text-emerald-950">
                <li>⭐ High price makes buyers buy less (Demand).</li>
                <li>⭐ High price makes sellers supply more (Supply).</li>
                <li>⭐ The cross point is Market Balance!</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="border-t-2 border-emerald-200 pt-1.5 flex justify-between text-[10px] font-bold text-emerald-700">
        <span>PLAYFUL BENTO GRID &amp; STICKY NOTES</span>
        <span>STUDENT-FRIENDLY VISUAL LEARNING</span>
      </div>
    </div>
  );
}

// =============================================================================
// 4. STEM TECHNICAL BLUEPRINT PPT SLIDE (CAD Schematic & Monospace Grid)
// =============================================================================
function StemBlueprintSlide({
  slideIdx,
  standardName,
  subjectName,
  chapterName,
  teachingApproach,
  template,
}: TemplateDesignCanvasProps) {
  return (
    <div className="h-full flex flex-col justify-between text-cyan-200 font-mono relative">
      {/* CAD Coordinate Markers in 4 Corners */}
      <span className="absolute -top-2 -left-2 text-[9px] text-cyan-500 opacity-70">+ [0.00, 0.00]</span>
      <span className="absolute -top-2 -right-2 text-[9px] text-cyan-500 opacity-70">[1920.00, 0.00] +</span>
      <span className="absolute -bottom-2 -left-2 text-[9px] text-cyan-500 opacity-70">+ [0.00, 1080.00]</span>
      <span className="absolute -bottom-2 -right-2 text-[9px] text-cyan-500 opacity-70">[CAD-ISO-4.0] +</span>

      {/* CAD Title Block Header */}
      <div className="border-b border-cyan-500/40 pb-1.5 flex items-center justify-between text-[10px] text-cyan-400">
        <div>
          <span className="text-cyan-300 font-bold">[DWG: 2026-ENG-42]</span> // {standardName} // {subjectName}
        </div>
        <div className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 bg-cyan-950 border border-cyan-500/50 rounded text-[9px] text-cyan-300">
            TOLERANCE: ±0.01%
          </span>
          <span className="text-cyan-400">STAGE 0{slideIdx + 1}</span>
        </div>
      </div>

      {/* Main Engineering Schematic Stage */}
      <div className="my-auto py-2">
        {slideIdx === 0 && (
          <div className="space-y-3">
            <div>
              <span className="text-[9px] text-cyan-400 uppercase tracking-widest block">
                ENGINEERING SPECIFICATION MATRIX // {teachingApproach}
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-cyan-300 uppercase tracking-wider">
                {chapterName}
              </h1>
              <p className="text-xs text-slate-400 max-w-xl mt-0.5">
                Cartesian vector mechanics, multi-variable equilibrium algorithms, and parameter tolerance analysis.
              </p>
            </div>

            {/* Parameter Matrix Telemetry Grid */}
            <div className="border border-cyan-500/40 bg-slate-950/80 p-3 rounded">
              <div className="text-[10px] text-cyan-300 font-bold border-b border-cyan-500/30 pb-1 mb-2 flex justify-between">
                <span>[INPUT PARAMETER CHANNELS]</span>
                <span className="text-emerald-400">STATUS: CALIBRATED</span>
              </div>
              <div className="grid grid-cols-3 gap-2.5 text-xs">
                <div className="bg-cyan-950/40 border border-cyan-500/20 p-2 rounded">
                  <span className="text-[9px] text-cyan-400 block font-bold">[PARAM-01]</span>
                  <div className="text-cyan-200 font-bold text-[11px]">Qd = f(P, Y, Psub)</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Demand Vector Tensor</div>
                </div>
                <div className="bg-cyan-950/40 border border-cyan-500/20 p-2 rounded">
                  <span className="text-[9px] text-cyan-400 block font-bold">[PARAM-02]</span>
                  <div className="text-cyan-200 font-bold text-[11px]">Qs = g(P, Cmat, Tech)</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Supply Tensor Gradient</div>
                </div>
                <div className="bg-cyan-950/40 border border-cyan-500/20 p-2 rounded">
                  <span className="text-[9px] text-cyan-400 block font-bold">[PARAM-03]</span>
                  <div className="text-cyan-200 font-bold text-[11px]">Qd - Qs = 0 (E*)</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Zero Residual Clearance</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {slideIdx === 1 && (
          <div className="grid grid-cols-2 gap-4 items-center">
            <div className="border border-cyan-500/30 bg-slate-950/80 p-3 rounded space-y-2">
              <span className="text-[9px] text-cyan-400 uppercase tracking-widest block">
                TELEMETRY LOG // PROVOCATION TRIGGER
              </span>
              <h3 className="text-base font-bold text-cyan-300">Empirical Demand Shock Trigger</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Step-function temperature increment induces +300% consumption velocity within Δt = 4 hours. Kiosk inventories depleted.
              </p>
              <div className="bg-cyan-950/60 p-2 border border-cyan-500/30 rounded text-[10px] text-amber-300">
                [ANOMALY CHECK]: Unit manufacture cost invariant. Calculate price equilibrium trajectory.
              </div>
            </div>

            <div className="border border-cyan-500/40 rounded overflow-hidden p-1 bg-slate-950 shadow-lg">
              <img src={template.visualHookImg} alt="CAD Hook" className="w-full h-36 object-cover" />
              <div className="text-[9px] text-cyan-400 text-center mt-1">
                [CAD SCHEMATIC REF: OBS-HOOK-V4]
              </div>
            </div>
          </div>
        )}

        {slideIdx === 2 && (
          <div className="grid grid-cols-2 gap-4 items-center">
            <div className="border border-cyan-500/30 bg-slate-950/80 p-3 rounded space-y-2">
              <span className="text-[9px] text-cyan-400 uppercase tracking-widest block">
                EQUATION DERIVATION // CLEARANCE
              </span>
              <h3 className="text-base font-bold text-cyan-300">Cartesian Intersection</h3>
              <div className="bg-cyan-950/60 p-2 rounded border border-cyan-500/20 text-xs">
                <code>P* = (α + γ) / (β + δ)</code>
              </div>
              <p className="text-xs text-slate-300">
                Intersection vector eliminates excess market inventories without external subsidy intervention.
              </p>
            </div>

            <div className="border border-cyan-500/40 rounded p-2 bg-slate-950">
              <DynamicMarketVectorDiagram template={template} />
            </div>
          </div>
        )}

        {slideIdx === 3 && (
          <div className="grid grid-cols-2 gap-4 items-center">
            <div className="border border-cyan-500/30 bg-slate-950/80 p-3 rounded space-y-1.5">
              <span className="text-[9px] text-amber-400 uppercase tracking-wider block">
                SYSTEM STRESS TEST // CEILING LIMIT
              </span>
              <p className="text-xs text-slate-300">
                Clamp price at Pmax &lt; P*. Resultant: Qd &gt; Qs produces chronic system deficit.
              </p>
              <div className="bg-rose-950/40 border border-rose-500/30 p-1.5 rounded text-[10px] text-rose-300">
                DEFICIT DIVERGENCE: Secondary unregulated arbitrage detected.
              </div>
            </div>

            <div className="border border-cyan-500/30 bg-slate-950/80 p-3 rounded space-y-1.5 text-xs">
              <span className="text-[9px] text-cyan-300 font-bold uppercase tracking-wider block">
                SYSTEM TELEMETRY SUMMARY
              </span>
              <ul className="space-y-1 text-slate-300">
                <li>• Gradient: ∂Qd/∂P &lt; 0 (Inverse slope)</li>
                <li>• Gradient: ∂Qs/∂P &gt; 0 (Direct slope)</li>
                <li>• System stability: dP/dt = -λ(Qs - Qd)</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* CAD Terminal Footer */}
      <div className="border-t border-cyan-500/40 pt-1.5 flex justify-between text-[10px] text-cyan-500">
        <span>ISO-9001 STEM CAD TELEMETRY SYSTEM</span>
        <span>SPEC-VALIDATED ARCHITECTURE</span>
      </div>
    </div>
  );
}

// =============================================================================
// 5. HUMANITIES & WARM EDITORIAL PPT SLIDE (Magazine Article / Literary Spread)
// =============================================================================
function WarmEditorialSlide({
  slideIdx,
  standardName,
  subjectName,
  chapterName,
  teachingApproach,
  template,
}: TemplateDesignCanvasProps) {
  return (
    <div className="h-full flex flex-col justify-between text-stone-900 font-serif relative">
      {/* Editorial Masthead */}
      <div className="border-b-2 border-stone-800/40 pb-2 flex items-center justify-between text-stone-700">
        <div className="flex items-center gap-2">
          <span className="font-serif italic font-bold text-xs text-stone-900 tracking-wider">
            THE ACADEMIC OBSERVER
          </span>
          <span className="text-stone-400">•</span>
          <span className="text-[11px] uppercase tracking-widest font-sans text-stone-600">
            {standardName} // {subjectName}
          </span>
        </div>
        <span className="font-serif italic text-xs text-orange-950 font-bold">
          Monograph No. {slideIdx + 1}
        </span>
      </div>

      {/* Main Editorial Stage */}
      <div className="my-auto py-2">
        {slideIdx === 0 && (
          <div className="grid grid-cols-12 gap-5 items-center">
            <div className="col-span-7 space-y-2.5">
              <span className="text-[10px] font-sans font-bold tracking-widest text-orange-800 uppercase">
                FEATURE ESSAY // {teachingApproach}
              </span>
              <h1 className="text-3xl font-serif font-extrabold text-stone-950 leading-tight">
                {chapterName}
              </h1>
              <p className="text-xs text-stone-600 italic leading-relaxed">
                An inquiry into the quiet architecture of commerce, human decision under scarcity, and the subtle forces that govern modern exchange.
              </p>
            </div>

            {/* Asymmetrical Editorial Column */}
            <div className="col-span-5 border-l-2 border-stone-800/30 pl-4 space-y-2">
              <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-stone-500">
                Key Investigations
              </div>
              <div className="space-y-2 text-xs">
                <div className="border-b border-stone-200 pb-1.5">
                  <span className="font-serif italic font-bold text-orange-900 block text-[11px]">Chapter I</span>
                  <p className="text-[11px] text-stone-700 leading-snug">The consumer’s delicate calculation of price and desire.</p>
                </div>
                <div className="border-b border-stone-200 pb-1.5">
                  <span className="font-serif italic font-bold text-orange-900 block text-[11px]">Chapter II</span>
                  <p className="text-[11px] text-stone-700 leading-snug">The producer’s margin and the quiet geometry of market equilibrium.</p>
                </div>
                <div>
                  <span className="font-serif italic font-bold text-orange-900 block text-[11px]">Chapter III</span>
                  <p className="text-[11px] text-stone-700 leading-snug">Unintended ripples when legal ceilings disrupt natural exchange.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {slideIdx === 1 && (
          <div className="grid grid-cols-12 gap-5 items-center">
            <div className="col-span-7 space-y-2">
              <span className="text-[10px] font-sans font-bold tracking-widest text-orange-800 uppercase">
                THE NARRATIVE HOOK
              </span>
              <h3 className="text-lg font-serif font-bold text-stone-950">A Thirst Across the Square</h3>
              <p className="text-xs text-stone-700 leading-relaxed font-sans">
                <span className="text-3xl float-left font-serif font-bold text-orange-950 leading-none mr-2">O</span>
                n an unexpectedly scorching afternoon, a marketplace finds its customary balance broken. Thirst multiplies rapidly. Before the sun has reached its zenith, stallholders notice empty shelves and wholesale cost escalating.
              </p>
              <div className="border-y border-orange-900/30 py-1.5 text-xs italic text-stone-800 font-serif">
                “If the physical ingredients of each glass were identical to yesterday, why did the price of refreshment ascend?”
              </div>
            </div>

            <div className="col-span-5 border border-stone-300 p-1 bg-white shadow-sm">
              <img src={template.visualHookImg} alt="Editorial Plate" className="w-full h-36 object-cover" />
              <div className="text-[10px] italic text-stone-500 text-center mt-1">
                Plate I: Human commerce in a dynamic bazaar
              </div>
            </div>
          </div>
        )}

        {slideIdx === 2 && (
          <div className="grid grid-cols-12 gap-5 items-center">
            <div className="col-span-6 space-y-2">
              <span className="text-[10px] font-sans font-bold tracking-widest text-orange-800 uppercase">
                THE GEOMETRY OF COMMERCE
              </span>
              <h3 className="text-lg font-serif font-bold text-stone-950">The Moment of Clearance</h3>
              <p className="text-xs text-stone-700 font-sans leading-relaxed">
                Equilibrium is not static permanence; it is the living intersection where what is willingly purchased precisely balances what is willingly brought to market.
              </p>
              <blockquote className="border-l-2 border-orange-800 pl-3 text-xs italic text-stone-800 font-serif">
                “Price acts as an eloquent signal, speaking across distance without words.”
              </blockquote>
            </div>

            <div className="col-span-6 border border-stone-300 p-2 bg-white">
              <DynamicMarketVectorDiagram template={template} />
            </div>
          </div>
        )}

        {slideIdx === 3 && (
          <div className="grid grid-cols-2 gap-5 items-center">
            <div className="border-t-2 border-b-2 border-stone-800 py-3 space-y-1.5">
              <span className="text-[10px] font-sans font-bold tracking-widest text-orange-900 uppercase">
                THE ESSAYIST’S INQUIRY
              </span>
              <p className="text-xs text-stone-800 font-serif italic">
                When authorities decree an artificial ceiling price beneath natural clearing levels, goodwill frequently yields to scarcity, queues, and parallel trade.
              </p>
            </div>

            <div className="bg-orange-50/50 border border-orange-200 p-3 space-y-1.5 text-xs font-sans">
              <span className="text-[10px] font-bold text-orange-950 uppercase tracking-wider block">
                Editorial Takeaways
              </span>
              <ul className="space-y-1 text-stone-700">
                <li>• Scarcity forces allocation choices in every human society.</li>
                <li>• Prices communicate real-time consumer priorities.</li>
                <li>• Dynamic equilibrium protects against systemic waste.</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Editorial Foot */}
      <div className="border-t border-stone-300 pt-2 flex justify-between text-[10px] font-sans text-stone-500">
        <span>MAGAZINE EDITORIAL MONOGRAPH FORMAT</span>
        <span>ESSAY &amp; LITERARY SPREAD</span>
      </div>
    </div>
  );
}

// =============================================================================
// 6. MINIMALIST EXECUTIVE PPT SLIDE (Swiss High-Design & Stark Typography)
// =============================================================================
function MinimalistCleanSlide({
  slideIdx,
  standardName,
  subjectName,
  chapterName,
  teachingApproach,
  template,
}: TemplateDesignCanvasProps) {
  return (
    <div className="h-full flex flex-col justify-between text-slate-950 font-sans relative">
      {/* Swiss Clean Top Line */}
      <div className="border-b border-black pb-2 flex items-center justify-between text-[11px] font-mono uppercase tracking-widest">
        <div className="flex items-center gap-2">
          <span className="font-bold">{standardName} / {subjectName}</span>
          <span>•</span>
          <span className="text-slate-500">{teachingApproach}</span>
        </div>
        <span className="font-bold">SLIDE 0{slideIdx + 1} / 04</span>
      </div>

      {/* Main Swiss Minimal Stage */}
      <div className="my-auto py-2">
        {slideIdx === 0 && (
          <div className="space-y-4">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                01 / EXECUTIVE DECK SPECIFICATION
              </span>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-black tracking-tight mt-1">
                {chapterName}
              </h1>
              <p className="text-xs text-slate-600 mt-1 max-w-xl">
                A clean, distraction-free analytical presentation of market clearing mechanics and supply-demand elasticity.
              </p>
            </div>

            {/* Swiss Stark 3-Index Grid */}
            <div className="grid grid-cols-3 gap-6 pt-2 border-t border-slate-200">
              <div>
                <span className="text-2xl font-bold font-mono text-black block">01</span>
                <h4 className="text-xs font-bold text-black mt-1">Demand Function</h4>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">Inverse unit price sensitivity and marginal utility curve.</p>
              </div>
              <div>
                <span className="text-2xl font-bold font-mono text-black block">02</span>
                <h4 className="text-xs font-bold text-black mt-1">Equilibrium Model</h4>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">Autonomous market convergence at clearing price P*.</p>
              </div>
              <div>
                <span className="text-2xl font-bold font-mono text-black block">03</span>
                <h4 className="text-xs font-bold text-black mt-1">Policy Controls</h4>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">Empirical analysis of price ceilings and supply shortages.</p>
              </div>
            </div>
          </div>
        )}

        {slideIdx === 1 && (
          <div className="grid grid-cols-2 gap-6 items-center">
            <div className="space-y-2">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                02 / OBSERVATION GROUNDING
              </span>
              <h3 className="text-xl font-bold text-black">The Observable Scenario</h3>
              <p className="text-xs text-slate-700 leading-relaxed">
                During sudden weather shocks, consumption demand surges rapidly. Stock clears within hours; clearing prices elevate.
              </p>
              <div className="border-l border-black pl-3 py-1 text-xs text-black font-medium">
                Core Inquiry: Unit production costs remained identical. What mechanism adjusted unit price?
              </div>
            </div>

            <div className="border border-slate-300 p-1">
              <img src={template.visualHookImg} alt="Swiss Hook" className="w-full h-36 object-cover grayscale contrast-125" />
              <div className="text-[10px] font-mono text-slate-600 mt-1 text-right">
                FIG. 01 — OBSERVATIONAL GROUNDING
              </div>
            </div>
          </div>
        )}

        {slideIdx === 2 && (
          <div className="grid grid-cols-2 gap-6 items-center">
            <div className="space-y-2">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                03 / MATHEMATICAL MODEL
              </span>
              <h3 className="text-xl font-bold text-black">Dynamic Clearance</h3>
              <p className="text-xs text-slate-700 leading-relaxed">
                Equilibrium represents the exact coordinates where Qd = Qs, clearing excess inventories automatically without intervention.
              </p>
              <div className="text-[11px] font-mono text-slate-600 space-y-0.5 pt-1">
                <div>[1] Inverse Demand: P ↑ ⇒ Qd ↓</div>
                <div>[2] Direct Supply: P ↑ ⇒ Qs ↑</div>
              </div>
            </div>

            <div className="border border-black p-2">
              <DynamicMarketVectorDiagram template={template} />
            </div>
          </div>
        )}

        {slideIdx === 3 && (
          <div className="grid grid-cols-2 gap-6 items-center">
            <div className="border border-black p-3 space-y-1.5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider block">
                04 / POLICY STRESS TEST
              </span>
              <p className="text-xs text-slate-800">
                Imposition of a binding ceiling price below market clearing P* produces chronic deficit.
              </p>
            </div>

            <div className="border border-slate-200 p-3 space-y-1.5 text-xs">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
                EXECUTIVE SUMMARY
              </span>
              <ul className="space-y-1 text-slate-800">
                <li>• Price conveys real-time scarcity signals.</li>
                <li>• Self-correction restores balance organically.</li>
                <li>• Distortions generate unintended secondary impacts.</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Swiss Clean Bottom Line */}
      <div className="border-t border-black pt-2 flex justify-between text-[10px] font-mono text-slate-600">
        <span>SWISS INTERNATIONAL TYPOGRAPHIC STYLE</span>
        <span>EXECUTIVE BRIEFING FORMAT</span>
      </div>
    </div>
  );
}

// =============================================================================
// 7. INFOGRAPHIC VISUAL PPT SLIDE (Process Pipeline & KPI Cards)
// =============================================================================
function InfographicVisualSlide({
  slideIdx,
  standardName,
  subjectName,
  chapterName,
  teachingApproach,
  template,
}: TemplateDesignCanvasProps) {
  return (
    <div className="h-full flex flex-col justify-between text-slate-100 font-sans relative">
      {/* Top Visual Header */}
      <div className="flex items-center justify-between border-b border-sky-500/30 pb-2">
        <div className="flex items-center gap-2">
          <span className="bg-sky-950 text-sky-300 border border-sky-500/40 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <BarChart3 className="size-3 text-sky-400" />
            INFOGRAPHIC FLOW
          </span>
          <span className="text-xs font-semibold text-slate-300">
            {standardName} • {subjectName}
          </span>
        </div>
        <span className="text-[10px] font-mono text-sky-400">
          MILESTONE {slideIdx + 1}/4
        </span>
      </div>

      {/* Main Infographic Stage */}
      <div className="my-auto py-2">
        {slideIdx === 0 && (
          <div className="space-y-3.5">
            <div>
              <span className="text-[10px] font-mono text-sky-400 uppercase tracking-wider">
                VISUAL ROADMAP // {teachingApproach}
              </span>
              <h1 className="text-3xl font-extrabold text-sky-300 tracking-tight mt-0.5">
                {chapterName}
              </h1>
              <p className="text-xs text-slate-300 mt-1 max-w-xl">
                A diagram-first visual learning sequence: from real-world shocks to graphical equilibrium proofs.
              </p>
            </div>

            {/* Horizontal Milestone Pipeline */}
            <div className="bg-sky-950/40 border border-sky-500/30 rounded-xl p-3">
              <div className="text-[10px] font-bold text-sky-400 uppercase tracking-wider mb-2">
                3-Step Learning Pipeline
              </div>
              <div className="grid grid-cols-3 gap-2 relative">
                <div className="bg-slate-900/80 border border-sky-500/30 rounded-lg p-2.5 text-center relative">
                  <div className="size-6 bg-sky-500 text-slate-950 rounded-full flex items-center justify-center font-bold text-xs mx-auto mb-1">
                    1
                  </div>
                  <h4 className="text-xs font-bold text-sky-200">The Shock</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Real-world case analysis</p>
                </div>

                <div className="bg-slate-900/80 border border-sky-500/30 rounded-lg p-2.5 text-center relative">
                  <div className="size-6 bg-cyan-400 text-slate-950 rounded-full flex items-center justify-center font-bold text-xs mx-auto mb-1">
                    2
                  </div>
                  <h4 className="text-xs font-bold text-cyan-200">The Curve</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Vector equilibrium proof</p>
                </div>

                <div className="bg-slate-900/80 border border-sky-500/30 rounded-lg p-2.5 text-center relative">
                  <div className="size-6 bg-emerald-400 text-slate-950 rounded-full flex items-center justify-center font-bold text-xs mx-auto mb-1">
                    3
                  </div>
                  <h4 className="text-xs font-bold text-emerald-200">The Impact</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Policy ceiling simulation</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {slideIdx === 1 && (
          <div className="grid grid-cols-2 gap-4 items-center">
            <div className="space-y-2">
              <span className="text-[10px] font-mono text-sky-400 uppercase tracking-widest">
                STEP 01 // PROVOCATION
              </span>
              <h3 className="text-lg font-bold text-sky-200">The Heatwave Scenario</h3>
              <div className="bg-sky-950/40 border border-sky-500/30 rounded-xl p-3 text-xs text-slate-200 space-y-1.5">
                <p>Demand spikes dramatically. Wholesale supplier prices climb as stock vanishes.</p>
                <div className="border-t border-sky-900 pt-1 text-[11px] text-amber-300 font-semibold">
                  Why does price adjust when production cost is identical?
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-sky-500/40 overflow-hidden shadow-lg">
              <img src={template.visualHookImg} alt="Visual Hook" className="w-full h-36 object-cover" />
              <div className="bg-slate-950 p-1.5 text-center text-[10px] font-mono text-sky-400">
                INFOGRAPHIC VISUAL ANCHOR
              </div>
            </div>
          </div>
        )}

        {slideIdx === 2 && (
          <div className="grid grid-cols-12 gap-4 items-center">
            <div className="col-span-5 space-y-2">
              <span className="text-[10px] font-mono text-sky-400 uppercase tracking-widest">
                STEP 02 // VISUAL MODEL
              </span>
              <h3 className="text-lg font-bold text-sky-200">Dynamic Equilibrium</h3>
              <p className="text-xs text-slate-300">
                The equilibrium point clears the market automatically without residual surplus or deficit.
              </p>
            </div>

            <div className="col-span-7 bg-slate-900/80 border border-sky-500/30 rounded-xl p-2.5 shadow-xl">
              <DynamicMarketVectorDiagram template={template} />
            </div>
          </div>
        )}

        {slideIdx === 3 && (
          <div className="grid grid-cols-2 gap-4 items-center">
            <div className="bg-sky-950/40 border border-sky-500/30 rounded-xl p-3 space-y-2">
              <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider block">
                STEP 03 // SIMULATION
              </span>
              <p className="text-xs text-slate-200">
                Legal price cap produces chronic shortage and secondary market distortion.
              </p>
            </div>

            <div className="bg-slate-900/80 border border-sky-500/30 rounded-xl p-3 space-y-2 text-xs">
              <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider block">
                INFOGRAPHIC TAKEAWAYS
              </span>
              <ul className="space-y-1 text-slate-300">
                <li>• Law of Demand: Inverse price relationship.</li>
                <li>• Law of Supply: Direct price relationship.</li>
                <li>• Equilibrium: Natural convergence point.</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Visual Footer */}
      <div className="border-t border-sky-500/30 pt-1.5 flex justify-between text-[10px] font-mono text-slate-400">
        <span>INFOGRAPHIC STEP PIPELINE FORMAT</span>
        <span>VISUAL FLOW &amp; DATA CARDS</span>
      </div>
    </div>
  );
}

// =============================================================================
// 8. GAMIFIED QUEST PPT SLIDE (RPG Quest Log & Boss Battle HUD)
// =============================================================================
function GamifiedQuestSlide({
  slideIdx,
  standardName,
  subjectName,
  chapterName,
  teachingApproach,
  template,
}: TemplateDesignCanvasProps) {
  return (
    <div className="h-full flex flex-col justify-between text-fuchsia-100 font-sans relative">
      {/* RPG HUD Top Bar */}
      <div className="flex items-center justify-between border-b-2 border-purple-500/40 pb-2">
        <div className="flex items-center gap-2">
          <span className="bg-purple-950 text-amber-300 border border-purple-500 text-xs font-bold px-2.5 py-0.5 rounded-lg flex items-center gap-1 shadow-md">
            <span>⚔️</span> QUEST HUD // LVL 09
          </span>
          <span className="text-xs font-semibold text-purple-300">
            {standardName} • {subjectName}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-400">
          <span>⭐ XP: +500</span>
          <span className="text-purple-400">CHECKPOINT {slideIdx + 1}/4</span>
        </div>
      </div>

      {/* Main Quest Stage */}
      <div className="my-auto py-2">
        {slideIdx === 0 && (
          <div className="space-y-3.5">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400">
                ⚔️ MAIN QUEST INITIATION • {teachingApproach}
              </span>
              <h1 className="text-3xl font-extrabold text-amber-300 tracking-wide mt-0.5 font-fredoka drop-shadow-md">
                {chapterName}
              </h1>
              <p className="text-xs text-purple-200 mt-1 max-w-xl">
                Accept the mission to unlock the secrets of the marketplace, decode buyer spells, and master equilibrium boss tactics!
              </p>
            </div>

            {/* 3 RPG Mission Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-purple-950/80 border-2 border-purple-500/50 rounded-xl p-3 shadow-lg">
                <span className="text-[9px] font-mono text-amber-400 font-bold block">MISSION 01</span>
                <h4 className="text-xs font-bold text-amber-300 mt-0.5 font-fredoka">The Demand Spell</h4>
                <p className="text-[11px] text-purple-200 mt-1 leading-snug">
                  Unlock the inverse law governing consumer purchase power.
                </p>
                <span className="inline-block mt-2 text-[9px] font-bold bg-purple-900 text-amber-300 px-1.5 py-0.5 rounded">
                  +150 XP
                </span>
              </div>

              <div className="bg-purple-950/80 border-2 border-purple-500/50 rounded-xl p-3 shadow-lg">
                <span className="text-[9px] font-mono text-amber-400 font-bold block">MISSION 02</span>
                <h4 className="text-xs font-bold text-amber-300 mt-0.5 font-fredoka">Equilibrium Gate</h4>
                <p className="text-[11px] text-purple-200 mt-1 leading-snug">
                  Reach the exact vector coordinate where markets clear.
                </p>
                <span className="inline-block mt-2 text-[9px] font-bold bg-purple-900 text-amber-300 px-1.5 py-0.5 rounded">
                  +150 XP
                </span>
              </div>

              <div className="bg-purple-950/80 border-2 border-purple-500/50 rounded-xl p-3 shadow-lg">
                <span className="text-[9px] font-mono text-amber-400 font-bold block">MISSION 03</span>
                <h4 className="text-xs font-bold text-amber-300 mt-0.5 font-fredoka">Boss Battle</h4>
                <p className="text-[11px] text-purple-200 mt-1 leading-snug">
                  Defeat price ceiling traps and solve Board exam dilemmas.
                </p>
                <span className="inline-block mt-2 text-[9px] font-bold bg-purple-900 text-amber-300 px-1.5 py-0.5 rounded">
                  +200 XP
                </span>
              </div>
            </div>
          </div>
        )}

        {slideIdx === 1 && (
          <div className="grid grid-cols-2 gap-4 items-center">
            <div className="bg-purple-950/80 border-2 border-purple-500/40 rounded-xl p-3 space-y-2">
              <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest block">
                QUEST LORE // CHAPTER 01
              </span>
              <h3 className="text-base font-bold text-amber-300 font-fredoka">
                The Heatwave Paradox Encounter
              </h3>
              <p className="text-xs text-purple-200 leading-relaxed">
                A sudden environmental heat debuff strikes the realm. Thirst gauges surge; inventories vanish by midday!
              </p>
              <div className="bg-purple-900/60 p-2 rounded-lg border border-purple-500/30 text-[11px] text-amber-300">
                ⭐ Quest Riddle: If potion manufacturing cost was identical, why did gold price double?
              </div>
            </div>

            <div className="rounded-xl border-2 border-purple-500/50 overflow-hidden shadow-xl">
              <img src={template.visualHookImg} alt="Quest Visual" className="w-full h-36 object-cover" />
              <div className="bg-purple-950 p-1.5 text-center text-[10px] font-mono text-amber-400">
                [QUEST ASSET: FIELD DISCOVERY MAP]
              </div>
            </div>
          </div>
        )}

        {slideIdx === 2 && (
          <div className="grid grid-cols-2 gap-4 items-center">
            <div className="space-y-2">
              <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest">
                SKILL TREE // STAGE 02
              </span>
              <h3 className="text-base font-bold text-amber-300 font-fredoka">
                The Balance Crosshair
              </h3>
              <div className="bg-purple-950/80 border border-purple-500/40 rounded-lg p-2 text-xs text-purple-200">
                Convergence point where buyers and sellers seal trades without excess baggage!
              </div>
              <div className="text-[11px] font-mono text-amber-400">
                <div>⚔️ Demand: P ↑ ⇒ Qd ↓ (Utility contraction)</div>
                <div>🛡️ Supply: P ↑ ⇒ Qs ↑ (Margin incentive)</div>
              </div>
            </div>

            <div className="bg-purple-950/80 border-2 border-purple-500/40 rounded-xl p-2.5">
              <DynamicMarketVectorDiagram template={template} />
            </div>
          </div>
        )}

        {slideIdx === 3 && (
          <div className="grid grid-cols-2 gap-4 items-center">
            <div className="bg-purple-950/80 border-2 border-rose-500/50 rounded-xl p-3 space-y-1.5">
              <span className="text-[10px] font-mono text-rose-400 font-bold uppercase tracking-wider block">
                ⚠️ BOSS ENCOUNTER: THE PRICE CEILING
              </span>
              <p className="text-xs text-purple-200">
                The ruler legally caps prices too low. Result: Supply dries up, black market thrives!
              </p>
            </div>

            <div className="bg-purple-950/80 border-2 border-amber-500/50 rounded-xl p-3 space-y-1.5 text-xs">
              <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider block">
                🏆 QUEST VICTORY LOOT
              </span>
              <ul className="space-y-1 text-purple-200">
                <li>⭐ Mastered Law of Demand &amp; Supply.</li>
                <li>⭐ Unlocked Equilibrium Coordinates.</li>
                <li>⭐ Completed Chapter Challenge (+500 XP)!</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* RPG HUD Footer */}
      <div className="border-t-2 border-purple-500/40 pt-1.5 flex justify-between text-[10px] font-mono text-purple-400">
        <span>GAMIFIED QUEST LOG &amp; BOSS BATTLE HUD</span>
        <span>LEVEL-UP COMPETENCY SYSTEM</span>
      </div>
    </div>
  );
}

// =============================================================================
// PDF DOCUMENT VIEW RENDERERS (ONE UNIQUE LAYOUT FOR EACH TEMPLATE)
// =============================================================================

function ModernTechDoc(props: TemplateDesignCanvasProps) {
  const { chapterName, standardName, subjectName, teachingApproach, template } = props;
  return (
    <div className="w-full max-w-4xl mx-auto border p-6 sm:p-8 space-y-5 bg-[#0b0f19] text-slate-100 border-indigo-500/30 rounded-2xl relative shadow-2xl font-sans">
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400" />
      
      {/* Dev Docs Header */}
      <div className="border-b border-indigo-500/20 pb-4 flex justify-between items-start">
        <div>
          <span className="bg-indigo-950 text-indigo-300 border border-indigo-700/50 text-[10px] font-mono px-2 py-0.5 rounded font-bold">
            DOCS_BUILD: v4.2.0-CBSE
          </span>
          <h2 className="text-2xl font-extrabold text-white mt-1.5">{chapterName}</h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            // {standardName} // {subjectName} // PEDAGOGY: {teachingApproach}
          </p>
        </div>
        <span className="text-xs font-mono text-cyan-400">STATUS: PRODUCTION_READY</span>
      </div>

      {/* Anchor Visual */}
      <div className="border border-indigo-500/30 rounded-xl overflow-hidden shadow-lg">
        <img src={template.heroCoverImg} alt="Cover" className="w-full h-36 object-cover" />
        <div className="p-2.5 bg-slate-900 text-xs font-mono text-indigo-300 flex justify-between border-t border-indigo-500/20">
          <span>[SYSTEM_HOOK: EMPIRICAL_DATA]</span>
          <span className="text-cyan-400">TELEMETRY_CALIBRATED</span>
        </div>
      </div>

      {/* API-Style Parameter Table */}
      <div className="space-y-2">
        <h3 className="text-sm font-mono font-bold text-indigo-300 flex items-center gap-1.5">
          <Terminal className="size-4 text-cyan-400" />
          MASTER_CONCEPT_PARAMETERS &amp; AXIOMS
        </h3>
        <div className="border border-indigo-500/20 rounded-xl overflow-hidden text-xs">
          <table className="w-full text-left font-mono">
            <thead className="bg-slate-900 text-indigo-300 border-b border-indigo-500/20 text-[11px]">
              <tr>
                <th className="p-2.5">PARAM_ID</th>
                <th className="p-2.5">CONCEPT_NAME</th>
                <th className="p-2.5">AXIOMATIC_FUNCTION</th>
                <th className="p-2.5">EXAM_YIELD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/60 text-slate-300 text-[11px]">
              <tr>
                <td className="p-2.5 text-cyan-400">01</td>
                <td className="p-2.5 font-bold text-white">Law of Demand</td>
                <td className="p-2.5">Inverse relationship: unit price vs quantity demanded.</td>
                <td className="p-2.5"><span className="text-emerald-400">HIGH_YIELD</span></td>
              </tr>
              <tr>
                <td className="p-2.5 text-cyan-400">02</td>
                <td className="p-2.5 font-bold text-white">Law of Supply</td>
                <td className="p-2.5">Direct relationship: unit price vs producer margin incentive.</td>
                <td className="p-2.5"><span className="text-emerald-400">HIGH_YIELD</span></td>
              </tr>
              <tr>
                <td className="p-2.5 text-cyan-400">03</td>
                <td className="p-2.5 font-bold text-white">Market Equilibrium</td>
                <td className="p-2.5">Convergence vector clearing all excess inventory (Qd = Qs).</td>
                <td className="p-2.5"><span className="text-cyan-400">CORE_ANCHOR</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="border-t border-indigo-500/20 pt-2 flex justify-between text-[11px] font-mono text-slate-500">
        <span>DEVELOPER DOCUMENTATION SPECIFICATION</span>
        <span>MODULAR TECH DOCS</span>
      </div>
    </div>
  );
}

function AcademicClassicDoc(props: TemplateDesignCanvasProps) {
  const { chapterName, standardName, subjectName, teachingApproach, template } = props;
  return (
    <div className="w-full max-w-4xl mx-auto border-4 border-double border-blue-900/30 p-6 sm:p-8 space-y-5 bg-[#faf7f0] text-slate-900 font-serif shadow-xl rounded">
      {/* Formal Academic Header */}
      <div className="border-b-2 border-blue-900/30 pb-3 flex justify-between items-start">
        <div>
          <span className="text-[10px] font-bold text-blue-900 uppercase tracking-widest block">
            CENTRAL BOARD OF SECONDARY EDUCATION • CURRICULUM SYLLABUS UNIT
          </span>
          <h2 className="text-2xl font-bold text-blue-950 font-serif mt-1">{chapterName}</h2>
          <p className="text-xs text-slate-600 italic">
            Standard: {standardName} • Subject: {subjectName} • Pedagogical Approach: {teachingApproach}
          </p>
        </div>
        <div className="text-right text-[10px] font-mono text-slate-600">
          <div className="font-bold text-blue-900">DOC-2026-CBSE</div>
          <div>Form VII-B</div>
        </div>
      </div>

      {/* Classical Plate Visual */}
      <div className="border border-slate-300 p-1 bg-white shadow-xs">
        <img src={template.heroCoverImg} alt="Cover" className="w-full h-36 object-cover" />
        <div className="p-1.5 text-center text-xs italic text-slate-700 border-t">
          Plate 1.1: Empirical Observations in Market Organization (CBSE Archives)
        </div>
      </div>

      {/* Oxford 3-Tier Academic Table */}
      <div className="space-y-1.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-blue-950 border-b border-blue-950/20 pb-1">
          Table 1: Master Concept Glossary &amp; Axioms
        </h3>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-y-2 border-blue-950 text-blue-950 font-bold">
              <th className="py-2 px-3">Item</th>
              <th className="py-2 px-3">Concept Nomenclature</th>
              <th className="py-2 px-3">Formal Definitional Axiom</th>
              <th className="py-2 px-3">Board Yield</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            <tr>
              <td className="py-2 px-3 font-mono">01</td>
              <td className="py-2 px-3 font-bold text-blue-900">Law of Demand</td>
              <td className="py-2 px-3 text-slate-700">Inverse relationship between unit price and consumer demand (*ceteris paribus*).</td>
              <td className="py-2 px-3"><span className="border border-blue-900 px-1.5 py-0.5 rounded text-[10px] font-bold text-blue-900">High Yield</span></td>
            </tr>
            <tr>
              <td className="py-2 px-3 font-mono">02</td>
              <td className="py-2 px-3 font-bold text-blue-900">Law of Supply</td>
              <td className="py-2 px-3 text-slate-700">Direct relationship between unit price and producer output driven by margin incentive.</td>
              <td className="py-2 px-3"><span className="border border-blue-900 px-1.5 py-0.5 rounded text-[10px] font-bold text-blue-900">High Yield</span></td>
            </tr>
            <tr>
              <td className="py-2 px-3 font-mono">03</td>
              <td className="py-2 px-3 font-bold text-blue-900">Market Equilibrium</td>
              <td className="py-2 px-3 text-slate-700">Dynamic convergence point where Qd = Qs, clearing excess inventories.</td>
              <td className="py-2 px-3"><span className="border border-blue-900 px-1.5 py-0.5 rounded text-[10px] font-bold text-blue-900">Core Anchor</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-300 pt-2 flex justify-between text-[11px] text-slate-600 italic">
        <span>Standard Print A4 Curriculum Reference</span>
        <span>Oxford Textbook Treatise Layout</span>
      </div>
    </div>
  );
}

function VibrantCreativeDoc(props: TemplateDesignCanvasProps) {
  const { chapterName, standardName, subjectName, template } = props;
  return (
    <div className="w-full max-w-4xl mx-auto border-2 border-emerald-300 p-6 sm:p-8 space-y-5 bg-[#f0fdf4] text-emerald-950 font-sans rounded-3xl shadow-xl">
      <div className="border-b-2 border-emerald-200 pb-3 flex justify-between items-start">
        <div>
          <span className="bg-emerald-200 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
            🎈 STUDENT STUDY WORKBOOK
          </span>
          <h2 className="text-2xl font-extrabold text-emerald-900 mt-1 font-outfit">{chapterName}</h2>
          <p className="text-xs text-emerald-700 mt-0.5">
            {standardName} • {subjectName} • Fun Classroom Edition
          </p>
        </div>
        <div className="border-2 border-dashed border-emerald-300 rounded-xl p-2 text-center text-xs text-emerald-800">
          Name: ________________ Date: ______
        </div>
      </div>

      {/* Polaroid Style Anchor */}
      <div className="bg-white border-2 border-emerald-200 rounded-2xl p-2 shadow-sm transform -rotate-1">
        <img src={template.heroCoverImg} alt="Cover" className="w-full h-36 object-cover rounded-xl" />
        <div className="text-center text-xs font-bold text-emerald-800 mt-2">
          🌟 Real-Life Visual Anchor: Why Do Prices Change?
        </div>
      </div>

      {/* Colorful Cards Table */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-emerald-900 flex items-center gap-1">
          <span>📋</span> Master Vocabulary Cards
        </h3>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-3">
            <span className="text-emerald-700 font-bold block">01. Law of Demand</span>
            <p className="text-[11px] text-slate-700 mt-1">When prices jump up, shopping carts empty out!</p>
          </div>
          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-3">
            <span className="text-amber-800 font-bold block">02. Law of Supply</span>
            <p className="text-[11px] text-slate-700 mt-1">When prices are high, sellers make way more stuff!</p>
          </div>
          <div className="bg-rose-50 border-2 border-rose-200 rounded-xl p-3">
            <span className="text-rose-800 font-bold block">03. Market Balance</span>
            <p className="text-[11px] text-slate-700 mt-1">The magic cross point where everyone is satisfied!</p>
          </div>
        </div>
      </div>

      <div className="border-t-2 border-emerald-200 pt-2 flex justify-between text-[11px] text-emerald-700 font-bold">
        <span>Student Illustrated Workbook Edition</span>
        <span>Playful Bento Format</span>
      </div>
    </div>
  );
}

function StemBlueprintDoc(props: TemplateDesignCanvasProps) {
  const { chapterName, standardName, subjectName, template } = props;
  return (
    <div className="w-full max-w-4xl mx-auto border border-cyan-500/50 p-6 sm:p-8 space-y-5 bg-[#031826] text-cyan-200 font-mono rounded shadow-2xl">
      <div className="border-b border-cyan-500/40 pb-3 flex justify-between items-start">
        <div>
          <span className="text-[10px] text-cyan-400 font-bold block">[ISO-ENG-DATASHEET: SPEC-42]</span>
          <h2 className="text-2xl font-bold text-cyan-300 uppercase mt-1">{chapterName}</h2>
          <p className="text-xs text-slate-400">// {standardName} // {subjectName}</p>
        </div>
        <div className="text-right text-[10px] text-cyan-400">
          <div>REV: 2026.04</div>
          <div>TOLERANCE: ±0.01%</div>
        </div>
      </div>

      <div className="border border-cyan-500/30 p-1 bg-slate-950">
        <img src={template.heroCoverImg} alt="Cover" className="w-full h-36 object-cover" />
        <div className="text-[10px] text-cyan-400 p-1 text-center border-t border-cyan-500/30">
          [CAD REF: SCHEMATIC SPECIFICATION 04 - CALIBRATION HOOK]
        </div>
      </div>

      <div className="border border-cyan-500/30 rounded p-3 bg-slate-950/80 space-y-2 text-xs">
        <div className="text-cyan-300 font-bold border-b border-cyan-500/20 pb-1">
          TELEMETRY PARAMETER SPECIFICATIONS
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="border border-cyan-500/20 p-2 rounded bg-cyan-950/30">
            <span className="text-cyan-400 block font-bold">[PARAM 01]</span>
            <div className="text-white font-bold">Law of Demand</div>
            <div className="text-[10px] text-slate-400 mt-1">∂Qd/∂P &lt; 0 (Inverse Tensor)</div>
          </div>
          <div className="border border-cyan-500/20 p-2 rounded bg-cyan-950/30">
            <span className="text-cyan-400 block font-bold">[PARAM 02]</span>
            <div className="text-white font-bold">Law of Supply</div>
            <div className="text-[10px] text-slate-400 mt-1">∂Qs/∂P &gt; 0 (Direct Tensor)</div>
          </div>
          <div className="border border-cyan-500/20 p-2 rounded bg-cyan-950/30">
            <span className="text-cyan-400 block font-bold">[PARAM 03]</span>
            <div className="text-white font-bold">Equilibrium E*</div>
            <div className="text-[10px] text-slate-400 mt-1">Zero Residual Clearance</div>
          </div>
        </div>
      </div>

      <div className="border-t border-cyan-500/40 pt-2 flex justify-between text-[11px] text-cyan-500">
        <span>ISO-STEM TECHNICAL DATASHEET</span>
        <span>ENGINEERING CAD MATRIX FORMAT</span>
      </div>
    </div>
  );
}

function WarmEditorialDoc(props: TemplateDesignCanvasProps) {
  const { chapterName, standardName, subjectName, template } = props;
  return (
    <div className="w-full max-w-4xl mx-auto border border-stone-300 p-6 sm:p-8 space-y-5 bg-[#fcfaf7] text-stone-900 font-serif rounded-xl shadow-lg">
      <div className="border-b border-stone-300 pb-3 flex justify-between items-start">
        <div>
          <span className="font-serif italic text-xs text-orange-950 font-bold block">
            THE ACADEMIC OBSERVER • MONOGRAPH EDITION
          </span>
          <h2 className="text-2xl font-serif font-bold text-stone-950 mt-1">{chapterName}</h2>
          <p className="text-xs text-stone-600 font-sans italic">{standardName} • {subjectName}</p>
        </div>
        <div className="text-xs font-sans uppercase tracking-widest text-stone-500">
          Vol. 2026 // Issue 4
        </div>
      </div>

      <div className="border border-stone-300 p-1 bg-white">
        <img src={template.heroCoverImg} alt="Cover" className="w-full h-36 object-cover" />
        <div className="text-center text-xs italic text-stone-600 p-1.5 border-t">
          Plate I: The Dynamic Bazaar of Trade &amp; Human Exchange
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5 text-xs font-sans">
        <div className="border-l-2 border-orange-800 pl-3 space-y-1">
          <span className="font-serif font-bold text-stone-950 text-sm block">The Nature of Demand</span>
          <p className="text-stone-700 leading-relaxed">
            As values fluctuate, consumers quietly reallocate desires, seeking equilibrium against finite wages.
          </p>
        </div>
        <div className="border-l-2 border-orange-800 pl-3 space-y-1">
          <span className="font-serif font-bold text-stone-950 text-sm block">The Response of Supply</span>
          <p className="text-stone-700 leading-relaxed">
            Producers mobilize capital when price signals reward effort, clearing markets through dynamic cooperation.
          </p>
        </div>
      </div>

      <div className="border-t border-stone-300 pt-2 flex justify-between text-[11px] font-sans text-stone-500">
        <span>Literary Journal Article Format</span>
        <span>Editorial Spread &amp; Drop-Caps</span>
      </div>
    </div>
  );
}

function MinimalistCleanDoc(props: TemplateDesignCanvasProps) {
  const { chapterName, standardName, subjectName, template } = props;
  return (
    <div className="w-full max-w-4xl mx-auto border border-black p-6 sm:p-8 space-y-5 bg-white text-slate-950 font-sans rounded-none shadow-md">
      <div className="border-b-2 border-black pb-3 flex justify-between items-start">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block">
            MEMORANDUM / EXECUTIVE BRIEFING SPEC
          </span>
          <h2 className="text-2xl font-bold text-black mt-1 tracking-tight">{chapterName}</h2>
          <p className="text-xs text-slate-600 font-mono mt-0.5">{standardName} / {subjectName}</p>
        </div>
        <span className="font-mono text-xs text-black font-bold">CONFIDENTIAL // 2026</span>
      </div>

      <div className="border border-black p-1">
        <img src={template.heroCoverImg} alt="Cover" className="w-full h-36 object-cover grayscale contrast-125" />
        <div className="text-[10px] font-mono text-black p-1 text-right">
          FIGURE 01 — OBSERVATIONAL GROUNDING
        </div>
      </div>

      <div className="border-t border-black pt-3 space-y-3">
        <div className="grid grid-cols-3 gap-6 text-xs">
          <div>
            <span className="text-xl font-bold font-mono text-black block">01</span>
            <div className="font-bold text-black mt-1">Law of Demand</div>
            <p className="text-slate-600 text-[11px] mt-0.5">Inverse unit price sensitivity curve.</p>
          </div>
          <div>
            <span className="text-xl font-bold font-mono text-black block">02</span>
            <div className="font-bold text-black mt-1">Law of Supply</div>
            <p className="text-slate-600 text-[11px] mt-0.5">Direct producer margin output incentive.</p>
          </div>
          <div>
            <span className="text-xl font-bold font-mono text-black block">03</span>
            <div className="font-bold text-black mt-1">Equilibrium</div>
            <p className="text-slate-600 text-[11px] mt-0.5">System clearance point clearing inventory.</p>
          </div>
        </div>
      </div>

      <div className="border-t border-black pt-2 flex justify-between text-[11px] font-mono text-slate-500">
        <span>SWISS INTERNATIONAL EXECUTIVE MEMO</span>
        <span>ASYMMETRIC GRID FORMAT</span>
      </div>
    </div>
  );
}

function InfographicVisualDoc(props: TemplateDesignCanvasProps) {
  const { chapterName, standardName, subjectName, template } = props;
  return (
    <div className="w-full max-w-4xl mx-auto border border-sky-500/40 p-6 sm:p-8 space-y-5 bg-[#060b19] text-slate-100 font-sans rounded-2xl shadow-2xl">
      <div className="border-b border-sky-500/30 pb-3 flex justify-between items-start">
        <div>
          <span className="bg-sky-950 text-sky-300 border border-sky-500/40 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
            📊 INFOGRAPHIC CHEAT SHEET
          </span>
          <h2 className="text-2xl font-extrabold text-sky-300 mt-1">{chapterName}</h2>
          <p className="text-xs text-slate-400">{standardName} • {subjectName}</p>
        </div>
        <span className="text-xs font-mono text-sky-400">VISUAL CHEAT SHEET</span>
      </div>

      <div className="border border-sky-500/30 rounded-xl overflow-hidden">
        <img src={template.heroCoverImg} alt="Cover" className="w-full h-36 object-cover" />
        <div className="p-2 bg-slate-900 text-xs font-mono text-sky-300 text-center">
          VISUAL HOOK: Consumer Behaviour Under Scarcity
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="bg-sky-950/40 border border-sky-500/30 rounded-xl p-3 text-center">
          <div className="size-6 bg-sky-500 text-black font-bold rounded-full mx-auto mb-1 flex items-center justify-center">1</div>
          <div className="font-bold text-sky-200">Demand Curve</div>
          <div className="text-[10px] text-slate-400 mt-1">Slopes downwards due to utility</div>
        </div>
        <div className="bg-sky-950/40 border border-sky-500/30 rounded-xl p-3 text-center">
          <div className="size-6 bg-cyan-400 text-black font-bold rounded-full mx-auto mb-1 flex items-center justify-center">2</div>
          <div className="font-bold text-cyan-200">Supply Curve</div>
          <div className="text-[10px] text-slate-400 mt-1">Slopes upwards due to profit</div>
        </div>
        <div className="bg-sky-950/40 border border-sky-500/30 rounded-xl p-3 text-center">
          <div className="size-6 bg-emerald-400 text-black font-bold rounded-full mx-auto mb-1 flex items-center justify-center">3</div>
          <div className="font-bold text-emerald-200">Equilibrium</div>
          <div className="text-[10px] text-slate-400 mt-1">Zero excess inventory</div>
        </div>
      </div>

      <div className="border-t border-sky-500/30 pt-2 flex justify-between text-[11px] font-mono text-slate-500">
        <span>INFOGRAPHIC VISUAL POSTER FORMAT</span>
        <span>STEP PIPELINE &amp; KPI MATRIX</span>
      </div>
    </div>
  );
}

function GamifiedQuestDoc(props: TemplateDesignCanvasProps) {
  const { chapterName, standardName, subjectName, template } = props;
  return (
    <div className="w-full max-w-4xl mx-auto border-2 border-purple-500/60 p-6 sm:p-8 space-y-5 bg-[#110722] text-fuchsia-100 font-sans rounded-2xl shadow-2xl">
      <div className="border-b-2 border-purple-500/40 pb-3 flex justify-between items-start">
        <div>
          <span className="bg-purple-950 text-amber-300 border border-purple-500 text-[10px] font-bold px-2.5 py-0.5 rounded-lg">
            ⚔️ ADVENTURER’S FIELD MANUAL
          </span>
          <h2 className="text-2xl font-bold text-amber-300 mt-1 font-fredoka">{chapterName}</h2>
          <p className="text-xs text-purple-300">{standardName} • {subjectName}</p>
        </div>
        <span className="text-xs font-mono font-bold text-amber-400">⭐ QUEST LOG +500 XP</span>
      </div>

      <div className="border-2 border-purple-500/50 rounded-xl overflow-hidden">
        <img src={template.heroCoverImg} alt="Cover" className="w-full h-36 object-cover" />
        <div className="p-2 bg-purple-950 text-xs font-mono text-amber-300 text-center">
          Quest Asset: Field Discovery Map &amp; Primary Clues
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="bg-purple-950/80 border border-purple-500/40 rounded-xl p-3">
          <span className="text-amber-400 font-bold block text-[11px]">QUEST ITEM #1</span>
          <div className="font-bold text-white mt-0.5">Demand Spell</div>
          <p className="text-[10px] text-purple-200 mt-1">Master price elasticity shield.</p>
        </div>
        <div className="bg-purple-950/80 border border-purple-500/40 rounded-xl p-3">
          <span className="text-amber-400 font-bold block text-[11px]">QUEST ITEM #2</span>
          <div className="font-bold text-white mt-0.5">Supply Potion</div>
          <p className="text-[10px] text-purple-200 mt-1">Mobilize producer inventory.</p>
        </div>
        <div className="bg-purple-950/80 border border-purple-500/40 rounded-xl p-3">
          <span className="text-amber-400 font-bold block text-[11px]">QUEST ITEM #3</span>
          <div className="font-bold text-white mt-0.5">Equilibrium Gate</div>
          <p className="text-[10px] text-purple-200 mt-1">Clear all excess obstacles.</p>
        </div>
      </div>

      <div className="border-t-2 border-purple-500/40 pt-2 flex justify-between text-[11px] font-mono text-purple-400">
        <span>ADVENTURER’S SPELLBOOK FORMAT</span>
        <span>RPG QUEST MANUAL</span>
      </div>
    </div>
  );
}

// =============================================================================
// MASTER TEMPLATE DESIGN CANVAS (DYNAMIC DISPATCHER)
// =============================================================================
export function TemplateDesignCanvas(props: TemplateDesignCanvasProps) {
  const { template, mode, isFullscreen = false } = props;

  // PDF Document Mode Dispatcher
  if (mode === 'pdf') {
    switch (template.id) {
      case 'academic_classic':
        return <AcademicClassicDoc {...props} />;
      case 'vibrant_creative':
        return <VibrantCreativeDoc {...props} />;
      case 'stem_blueprint':
        return <StemBlueprintDoc {...props} />;
      case 'warm_editorial':
        return <WarmEditorialDoc {...props} />;
      case 'minimalist_clean':
        return <MinimalistCleanDoc {...props} />;
      case 'infographic_visual':
        return <InfographicVisualDoc {...props} />;
      case 'gamified_quest':
        return <GamifiedQuestDoc {...props} />;
      case 'modern_tech':
      default:
        return <ModernTechDoc {...props} />;
    }
  }

  // PPT Presentation Slide Mode Dispatcher (Aspect-Ratio 16:9 container)
  const containerStyle: CSSProperties = {
    backgroundColor: template.slideBg,
    borderColor: template.borderColor,
    borderRadius: template.borderRadius,
    backgroundImage: template.patternCss !== 'none' ? template.patternCss : undefined,
    backgroundSize: template.patternType === 'blueprint' ? '24px 24px' : undefined,
  };

  return (
    <div
      className={`relative w-full aspect-video shadow-2xl border transition-all duration-300 flex flex-col justify-between overflow-hidden ${
        isFullscreen ? 'p-6 sm:p-9' : 'p-4 sm:p-6'
      }`}
      style={containerStyle}
    >
      {template.id === 'academic_classic' && <AcademicClassicSlide {...props} />}
      {template.id === 'vibrant_creative' && <VibrantCreativeSlide {...props} />}
      {template.id === 'stem_blueprint' && <StemBlueprintSlide {...props} />}
      {template.id === 'warm_editorial' && <WarmEditorialSlide {...props} />}
      {template.id === 'minimalist_clean' && <MinimalistCleanSlide {...props} />}
      {template.id === 'infographic_visual' && <InfographicVisualSlide {...props} />}
      {template.id === 'gamified_quest' && <GamifiedQuestSlide {...props} />}
      {template.id === 'modern_tech' && <ModernTechSlide {...props} />}
      {!['academic_classic', 'vibrant_creative', 'stem_blueprint', 'warm_editorial', 'minimalist_clean', 'infographic_visual', 'gamified_quest', 'modern_tech'].includes(template.id) && (
        <ModernTechSlide {...props} />
      )}
    </div>
  );
}
