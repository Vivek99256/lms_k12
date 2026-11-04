'use client';

import type { CSSProperties } from 'react';
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

export function TemplateDesignCanvas({
  template,
  mode,
  slideIdx,
  standardName,
  subjectName,
  chapterName,
  teachingApproach,
  isFullscreen = false,
}: TemplateDesignCanvasProps) {
  // Common visual container style derived directly from template tokens
  const containerStyle: CSSProperties = {
    backgroundColor: template.slideBg,
    color: template.textColor,
    borderColor: template.borderColor,
    fontFamily: template.fontFamilyBody,
    backgroundImage: template.patternCss !== 'none' ? template.patternCss : undefined,
    backgroundSize: template.patternType === 'blueprint' ? '24px 24px' : undefined,
    borderRadius: template.borderRadius,
  };

  if (mode === 'pdf') {
    return (
      <div
        className="w-full max-w-4xl mx-auto shadow-2xl border p-6 sm:p-8 space-y-5 transition-all duration-300 relative overflow-hidden"
        style={containerStyle}
      >
        {/* Top Accent Line for Modern Tech and Infographic */}
        {template.layoutVariant === 'tech_glass' && (
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400" />
        )}

        {/* Academic Double Border Effect */}
        {template.layoutVariant === 'academic_treatise' && (
          <div className="absolute inset-1.5 border-2 border-dashed border-amber-900/20 pointer-events-none rounded" />
        )}

        {/* STEM Coordinate Tick Marks */}
        {template.layoutVariant === 'stem_schematic' && (
          <>
            <span className="absolute top-2 left-2 font-mono text-[9px] text-cyan-500 opacity-60">+ [0,0]</span>
            <span className="absolute top-2 right-2 font-mono text-[9px] text-cyan-500 opacity-60">[A4_STD] +</span>
          </>
        )}

        {/* PDF Document Header */}
        <div
          className={`pb-4 flex flex-wrap items-center justify-between gap-3 ${
            template.layoutVariant === 'academic_treatise'
              ? 'border-b-2 border-double border-blue-900/30'
              : 'border-b'
          }`}
          style={{ borderColor: template.borderColor }}
        >
          <div>
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shadow-2xs"
                style={{
                  backgroundColor: template.badgeBg,
                  color: template.badgeTextColor,
                }}
              >
                {template.signatureBadge}
              </span>
              <span
                className="text-[10px] font-semibold"
                style={{ color: template.mutedColor }}
              >
                {template.layoutTag}
              </span>
            </div>

            <h2
              className="text-xl sm:text-2xl font-bold mt-1.5 tracking-tight"
              style={{
                fontFamily: template.fontFamilyHeading,
                color: template.headingColor,
              }}
            >
              {chapterName}
            </h2>
            <div className="text-xs mt-0.5" style={{ color: template.mutedColor }}>
              {standardName} • {subjectName} • Pedagogical Method: {teachingApproach}
            </div>
          </div>

          <div className="text-right text-[10px] font-mono" style={{ color: template.mutedColor }}>
            <div className="font-bold" style={{ color: template.accentColor }}>
              DOC-2026-CBSE
            </div>
            <div>Template: {template.name}</div>
          </div>
        </div>

        {/* Hero Visual Anchor */}
        <div
          className="overflow-hidden border shadow-sm relative group"
          style={{
            borderColor: template.borderColor,
            borderRadius: template.borderRadius,
          }}
        >
          <img
            src={template.heroCoverImg}
            alt="Document Anchor"
            className="w-full h-36 sm:h-44 object-cover transition duration-500 group-hover:scale-102"
          />
          <div
            className="p-2.5 text-[11px] font-semibold flex items-center justify-between border-t"
            style={{
              backgroundColor: template.cardBg,
              borderColor: template.borderColor,
              color: template.mutedColor,
            }}
          >
            <span className="flex items-center gap-1.5">
              <span>📷</span>
              {template.layoutVariant === 'academic_treatise' && 'Figure 1.1: Empirical Market Interactions (CBSE Archives)'}
              {template.layoutVariant === 'stem_schematic' && '[CAD REF: SCHEMATIC SPECIFICATION 04 - CALIBRATION HOOK]'}
              {template.layoutVariant === 'playful_bento' && '🌟 Real-Life Visual Anchor: Why Do Prices Change?'}
              {template.layoutVariant === 'editorial_journal' && 'Plate I: The Dynamic Bazaar of Trade & Human Exchange'}
              {template.layoutVariant === 'rpg_quest' && 'Quest Asset: Field Discovery Map & Primary Clues'}
              {template.layoutVariant === 'swiss_minimal' && 'FIGURE 01 — OBSERVATIONAL GROUNDING'}
              {template.layoutVariant === 'infographic_flow' && 'VISUAL HOOK: Consumer Behaviour Under Scarcity'}
              {template.layoutVariant === 'tech_glass' && 'SYSTEM SENSOR: Real-Time Market Exchange Data'}
            </span>
            <span
              className="font-bold text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: template.badgeBg,
                color: template.badgeTextColor,
              }}
            >
              {template.badge}
            </span>
          </div>
        </div>

        {/* Concept Vocabulary Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3
              className="text-sm font-bold flex items-center gap-1.5 tracking-tight"
              style={{
                fontFamily: template.fontFamilyHeading,
                color: template.headingColor,
              }}
            >
              <span>📋</span> Master Concept Glossary &amp; Axioms
            </h3>
            <span className="text-[10px] font-mono" style={{ color: template.mutedColor }}>
              Syllabus Aligned
            </span>
          </div>

          <div
            className="border overflow-hidden text-xs shadow-2xs"
            style={{
              borderColor: template.borderColor,
              borderRadius: template.borderRadius,
            }}
          >
            <table className="w-full text-left border-collapse">
              <thead>
                <tr
                  className="border-b"
                  style={{
                    backgroundColor: template.tableHeaderBg,
                    borderColor: template.borderColor,
                    color: template.textColor,
                  }}
                >
                  <th className="p-2.5 font-bold">#</th>
                  <th className="p-2.5 font-bold">Concept Term</th>
                  <th className="p-2.5 font-bold">Definitional Axiom</th>
                  <th className="p-2.5 font-bold">Exam Yield</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: template.borderColor }}>
                <tr>
                  <td className="p-2.5 font-mono font-bold">01</td>
                  <td className="p-2.5 font-semibold">Law of Demand</td>
                  <td className="p-2.5" style={{ color: template.mutedColor }}>
                    Inverse relationship between unit price and consumer demand (*ceteris paribus*).
                  </td>
                  <td className="p-2.5">
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                      style={{
                        backgroundColor: template.badgeBg,
                        color: template.badgeTextColor,
                      }}
                    >
                      High Yield
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="p-2.5 font-mono font-bold">02</td>
                  <td className="p-2.5 font-semibold">Law of Supply</td>
                  <td className="p-2.5" style={{ color: template.mutedColor }}>
                    Direct relationship between unit price and producer output driven by margin incentive.
                  </td>
                  <td className="p-2.5">
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                      style={{
                        backgroundColor: template.badgeBg,
                        color: template.badgeTextColor,
                      }}
                    >
                      High Yield
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="p-2.5 font-mono font-bold">03</td>
                  <td className="p-2.5 font-semibold">Market Equilibrium</td>
                  <td className="p-2.5" style={{ color: template.mutedColor }}>
                    Dynamic convergence point where Qd = Qs, clearing all excess inventories.
                  </td>
                  <td className="p-2.5">
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                      style={{
                        backgroundColor: template.badgeBg,
                        color: template.badgeTextColor,
                      }}
                    >
                      Core Anchor
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Template-Specific Footnote */}
        <div
          className="border-t pt-3 flex flex-wrap items-center justify-between text-[11px] gap-2"
          style={{ borderColor: template.borderColor, color: template.mutedColor }}
        >
          <span>Page 1 of 4 • Printable A4 Curriculum Revision Document</span>
          <span className="font-semibold flex items-center gap-1.5">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: template.paletteDot }}
            />
            {template.name} • Applied to all pages and handouts
          </span>
        </div>
      </div>
    );
  }

  // PPT Widescreen Slide Container (16:9)
  return (
    <div
      className={`relative w-full aspect-video shadow-2xl border transition-all duration-300 flex flex-col justify-between overflow-hidden ${
        isFullscreen ? 'p-6 sm:p-10' : 'p-4 sm:p-7'
      }`}
      style={containerStyle}
    >
      {/* Top Accent Line for Cyber and Infographic */}
      {template.layoutVariant === 'tech_glass' && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400" />
      )}

      {/* Academic Double Border Line */}
      {template.layoutVariant === 'academic_treatise' && (
        <div className="absolute inset-1.5 border-2 border-double border-blue-900/30 pointer-events-none rounded" />
      )}

      {/* STEM Coordinate Crosshairs */}
      {template.layoutVariant === 'stem_schematic' && (
        <>
          <span className="absolute top-2 left-2 font-mono text-[9px] text-cyan-500 opacity-60">+ [X:0, Y:0]</span>
          <span className="absolute top-2 right-2 font-mono text-[9px] text-cyan-500 opacity-60">[ISO-STEM-4.0] +</span>
          <span className="absolute bottom-2 left-2 font-mono text-[9px] text-cyan-500 opacity-60">+ [REF: 1080P]</span>
          <span className="absolute bottom-2 right-2 font-mono text-[9px] text-cyan-500 opacity-60">[TOLERANCE: 0.01] +</span>
        </>
      )}

      {/* Slide Topbar */}
      <div
        className={`flex items-center justify-between pb-2.5 ${
          template.layoutVariant === 'academic_treatise'
            ? 'border-b-2 border-double border-blue-900/20'
            : 'border-b'
        }`}
        style={{ borderColor: template.borderColor }}
      >
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shadow-2xs"
            style={{
              backgroundColor: template.badgeBg,
              color: template.badgeTextColor,
            }}
          >
            {standardName} • {subjectName}
          </span>
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              color: '#34d399',
            }}
          >
            Approach: {teachingApproach}
          </span>
          <span
            className="text-[10px] font-semibold hidden md:inline"
            style={{ color: template.mutedColor }}
          >
            {template.signatureBadge}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className="size-2 rounded-full animate-pulse"
            style={{ backgroundColor: template.paletteDot }}
          />
          <span
            className="text-[10px] font-mono font-bold uppercase tracking-wider"
            style={{ color: template.mutedColor }}
          >
            {template.name}
          </span>
        </div>
      </div>

      {/* Slide Content by Index */}
      <div className="flex-1 my-3 flex flex-col justify-center overflow-y-auto">
        {/* SLIDE 0: Hero Cover & Intentions */}
        {slideIdx === 0 && (
          <div className="space-y-3.5">
            <div>
              <span
                className="text-[10px] font-mono font-bold uppercase tracking-widest block mb-1"
                style={{ color: template.accentColor }}
              >
                {template.layoutVariant === 'stem_schematic' && '[DWG-2026-ENG-42] TECHNICAL SPECIFICATION'}
                {template.layoutVariant === 'academic_treatise' && 'CENTRAL BOARD OF SECONDARY EDUCATION • SYLLABUS UNIT'}
                {template.layoutVariant === 'playful_bento' && '🎈 CLASSROOM ADVENTURE DECK'}
                {template.layoutVariant === 'editorial_journal' && 'THE ACADEMIC OBSERVER • MONOGRAPH'}
                {template.layoutVariant === 'rpg_quest' && '⚔️ QUEST LOG: MISSION INITIATION'}
                {template.layoutVariant === 'swiss_minimal' && '01 / EXECUTIVE DECK SPECIFICATION'}
                {template.layoutVariant === 'infographic_flow' && 'VISUAL MILESTONE ROADMAP'}
                {template.layoutVariant === 'tech_glass' && '⚡ HIGH-IMPACT CONCEPT BLUEPRINT'}
              </span>
              <h2
                className="text-2xl sm:text-3xl font-extrabold leading-tight tracking-tight"
                style={{
                  fontFamily: template.fontFamilyHeading,
                  color: template.headingColor,
                }}
              >
                {chapterName}
              </h2>
              <p
                className="text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed"
                style={{ color: template.mutedColor }}
              >
                Comprehensive Master Presentation • Systematic Concept Deconstruction, Interactive Investigations &amp; Real-World Synthesis.
              </p>
            </div>

            <div
              className="p-3.5 border shadow-sm"
              style={{
                backgroundColor: template.calloutBg,
                borderColor: template.borderColor,
                borderRadius: template.borderRadius,
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5"
                  style={{ color: template.accentColor }}
                >
                  <Award className="size-3.5" />
                  🎯 Master Learning Intentions
                </span>
                <span
                  className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: template.badgeBg,
                    color: template.badgeTextColor,
                  }}
                >
                  3 Competency Anchors
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="flex items-start gap-2">
                  <span
                    className="flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white shadow-2xs"
                    style={{ backgroundColor: template.accentColor }}
                  >
                    01
                  </span>
                  <p className="leading-snug" style={{ color: template.textColor }}>
                    Deconstruct foundational laws, governing axioms, and market forces.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span
                    className="flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white shadow-2xs"
                    style={{ backgroundColor: template.accentColor }}
                  >
                    02
                  </span>
                  <p className="leading-snug" style={{ color: template.textColor }}>
                    Investigate empirical relationships, graphical models, and dynamic equilibrium.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span
                    className="flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white shadow-2xs"
                    style={{ backgroundColor: template.accentColor }}
                  >
                    03
                  </span>
                  <p className="leading-snug" style={{ color: template.textColor }}>
                    Apply analytical models to solve real-world policy dilemmas &amp; board questions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SLIDE 1: Real-World Hook & Photo */}
        {slideIdx === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="space-y-3">
              <div>
                <span
                  className="text-[10px] font-mono font-bold uppercase tracking-wider block"
                  style={{ color: template.accentColor }}
                >
                  Step 01 • Provocation Hook
                </span>
                <h3
                  className="text-lg sm:text-xl font-bold mt-0.5 tracking-tight"
                  style={{
                    fontFamily: template.fontFamilyHeading,
                    color: template.headingColor,
                  }}
                >
                  The Everyday Phenomenon: Why Does This Matter?
                </h3>
              </div>

              <div
                className="p-3 border space-y-1.5 shadow-2xs"
                style={{
                  backgroundColor: template.calloutBg,
                  borderColor: template.borderColor,
                  borderRadius: template.borderRadius,
                }}
              >
                <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                  🌟 The Observable Case Scenario
                </span>
                <p className="text-xs leading-relaxed" style={{ color: template.textColor }}>
                  During an unexpected heatwave, consumer thirst spikes dramatically. Kiosk owners notice inventory vanishing by noon, while supplier wholesale prices climb.
                </p>
                <p className="text-[11px] font-semibold" style={{ color: template.mutedColor }}>
                  <strong>Core Paradox:</strong> If the physical cost to produce each beverage was identical, why did the equilibrium price rise?
                </p>
              </div>

              <div
                className="p-2.5 border"
                style={{
                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                  borderColor: 'rgba(245, 158, 11, 0.3)',
                  borderRadius: template.borderRadius,
                }}
              >
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">
                  Inquiry Prompt
                </span>
                <p className="text-xs mt-0.5" style={{ color: template.textColor }}>
                  What silent interaction between buyers and sellers dictates the clearing price of any good in society?
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div
                className="overflow-hidden border shadow-md relative"
                style={{
                  borderColor: template.borderColor,
                  borderRadius: template.borderRadius,
                }}
              >
                <img
                  src={template.visualHookImg}
                  alt="Real-World Hook"
                  className="w-full h-36 sm:h-44 object-cover"
                />
                <div
                  className="p-2 text-[10px] font-semibold border-t flex items-center justify-between"
                  style={{
                    backgroundColor: template.cardBg,
                    borderColor: template.borderColor,
                    color: template.mutedColor,
                  }}
                >
                  <span>📷 Real-World Observable Anchor</span>
                  <span style={{ color: template.accentColor }}>Curriculum Grounded</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SLIDE 2: Core Concept & Dynamic SVG Vector Diagram */}
        {slideIdx === 2 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="space-y-2.5">
              <div>
                <span
                  className="text-[10px] font-mono font-bold uppercase tracking-wider block"
                  style={{ color: template.accentColor }}
                >
                  Step 02 • Core Mathematical &amp; Conceptual Model
                </span>
                <h3
                  className="text-lg sm:text-xl font-bold mt-0.5 tracking-tight"
                  style={{
                    fontFamily: template.fontFamilyHeading,
                    color: template.headingColor,
                  }}
                >
                  Market Equilibrium &amp; Clearing Mechanism
                </h3>
              </div>

              <div
                className="p-3 border-l-4"
                style={{
                  backgroundColor: template.calloutBg,
                  borderLeftColor: template.accentColor,
                  borderTop: `1px solid ${template.borderColor}`,
                  borderRight: `1px solid ${template.borderColor}`,
                  borderBottom: `1px solid ${template.borderColor}`,
                  borderRadius: template.borderRadius,
                }}
              >
                <span
                  className="text-[10px] font-bold uppercase tracking-wider block"
                  style={{ color: template.accentColor }}
                >
                  Definitional Foundation
                </span>
                <p className="text-xs leading-relaxed mt-0.5" style={{ color: template.textColor }}>
                  Equilibrium represents the exact intersection where quantity demanded (Qd) converges with quantity supplied (Qs), stabilizing unit price at P*.
                </p>
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: template.accentColor }} />
                  <span style={{ color: template.textColor }}>
                    <strong>Inverse Demand:</strong> P ↑ ⇒ Qd ↓ (diminishing marginal utility).
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: template.accentColor }} />
                  <span style={{ color: template.textColor }}>
                    <strong>Direct Supply:</strong> P ↑ ⇒ Qs ↑ (marginal profit motivation).
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: template.accentColor }} />
                  <span style={{ color: template.textColor }}>
                    <strong>Self-Correction:</strong> Market imbalances automatically self-clear without surplus.
                  </span>
                </div>
              </div>
            </div>

            {/* Live SVG Vector Diagram */}
            <div
              className="p-3 border shadow-md flex flex-col items-center justify-center relative overflow-hidden"
              style={{
                backgroundColor: template.cardBg,
                borderColor: template.borderColor,
                borderRadius: template.borderRadius,
              }}
            >
              <svg viewBox="0 0 420 200" className="w-full h-auto">
                {/* STEM Coordinate Grid */}
                {template.layoutVariant === 'stem_schematic' && (
                  <defs>
                    <pattern id="stemGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(6,182,212,0.12)" strokeWidth="0.8" />
                    </pattern>
                  </defs>
                )}
                {template.layoutVariant === 'stem_schematic' && (
                  <rect x="40" y="20" width="340" height="140" fill="url(#stemGrid)" />
                )}

                {/* Academic Shaded Surplus Regions */}
                {template.layoutVariant === 'academic_treatise' && (
                  <>
                    <polygon points="40,40 210,90 40,90" fill="rgba(30, 58, 138, 0.08)" />
                    <polygon points="40,90 210,90 40,140" fill="rgba(136, 19, 55, 0.08)" />
                  </>
                )}

                {/* Axes */}
                <line x1="40" y1="20" x2="40" y2="160" stroke={template.borderColor} strokeWidth="2" />
                <line x1="40" y1="160" x2="380" y2="160" stroke={template.borderColor} strokeWidth="2" />

                <text x="12" y="30" fill={template.mutedColor} fontSize="10" fontWeight="700">Price (P)</text>
                <text x="330" y="180" fill={template.mutedColor} fontSize="10" fontWeight="700">Quantity (Q)</text>

                {/* Demand Curve */}
                <line x1="70" y1="40" x2="350" y2="140" stroke="#f87171" strokeWidth="3" strokeLinecap="round" />
                <text x="355" y="145" fill="#f87171" fontSize="11" fontWeight="800">D</text>

                {/* Supply Curve */}
                <line x1="70" y1="140" x2="350" y2="40" stroke="#34d399" strokeWidth="3" strokeLinecap="round" />
                <text x="355" y="45" fill="#34d399" fontSize="11" fontWeight="800">S</text>

                {/* Equilibrium Point */}
                <circle cx="210" cy="90" r="10" fill={template.accentColor} fillOpacity="0.25" />
                <circle cx="210" cy="90" r="4" fill={template.accentColor} stroke="#ffffff" strokeWidth="1.5" />

                <line x1="40" y1="90" x2="210" y2="90" stroke={template.accentColor} strokeWidth="1.5" strokeDasharray="3,3" />
                <line x1="210" y1="90" x2="210" y2="160" stroke={template.accentColor} strokeWidth="1.5" strokeDasharray="3,3" />

                <text x="220" y="85" fill={template.headingColor} fontSize="11" fontWeight="800">
                  Equilibrium E (P*, Q*)
                </text>
              </svg>
              <span
                className="text-[10px] font-semibold mt-1"
                style={{ color: template.mutedColor }}
              >
                Figure: Dynamic Market Clearance Vector Graph
              </span>
            </div>
          </div>
        )}

        {/* SLIDE 3: Guided Simulation & Golden Takeaways */}
        {slideIdx === 3 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="space-y-3">
              <div>
                <span
                  className="text-[10px] font-mono font-bold uppercase tracking-wider block"
                  style={{ color: template.accentColor }}
                >
                  Step 03 • Guided Simulation
                </span>
                <h3
                  className="text-lg sm:text-xl font-bold mt-0.5 tracking-tight"
                  style={{
                    fontFamily: template.fontFamilyHeading,
                    color: template.headingColor,
                  }}
                >
                  Price Control &amp; Market Distortion
                </h3>
              </div>

              <div
                className="p-3 border space-y-2"
                style={{
                  backgroundColor: template.calloutBg,
                  borderColor: template.borderColor,
                  borderRadius: template.borderRadius,
                }}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                  Simulation Challenge: Legal Price Ceiling
                </span>
                <p className="text-xs leading-relaxed" style={{ color: template.textColor }}>
                  The authority legally caps staple commodity prices at ₹70/unit, while market clearing equilibrium is ₹110/unit.
                </p>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div
                    className="p-2 border"
                    style={{
                      backgroundColor: template.cardBg,
                      borderColor: template.borderColor,
                      borderRadius: template.borderRadius,
                    }}
                  >
                    <strong className="block text-indigo-400">Question A</strong>
                    <span style={{ color: template.mutedColor }}>Surplus or shortage?</span>
                  </div>
                  <div
                    className="p-2 border"
                    style={{
                      backgroundColor: template.cardBg,
                      borderColor: template.borderColor,
                      borderRadius: template.borderRadius,
                    }}
                  >
                    <strong className="block text-indigo-400">Question B</strong>
                    <span style={{ color: template.mutedColor }}>Unintended impacts?</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <div
                className="p-3 border space-y-1.5"
                style={{
                  backgroundColor: template.cardBg,
                  borderColor: template.borderColor,
                  borderRadius: template.borderRadius,
                }}
              >
                <span
                  className="text-[10px] font-bold uppercase tracking-wider block"
                  style={{ color: template.accentColor }}
                >
                  📌 4 Golden Takeaways
                </span>
                <ul className="text-xs space-y-1 list-disc list-inside" style={{ color: template.textColor }}>
                  <li><strong>Law of Demand:</strong> Inverse price/quantity relationship.</li>
                  <li><strong>Law of Supply:</strong> Direct price/incentive relationship.</li>
                  <li><strong>Equilibrium:</strong> Intersection point clearing the market.</li>
                  <li><strong>Shift vs Movement:</strong> Never confuse price movement with curve shift!</li>
                </ul>
              </div>

              <div
                className="p-2.5 border flex items-center gap-2"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  borderRadius: template.borderRadius,
                }}
              >
                <span className="text-sm">🚨</span>
                <p className="text-[11px] font-semibold text-rose-300">
                  <strong>Top Examiner Trap:</strong> Never write &ldquo;Demand increased because price dropped&rdquo;—write &ldquo;<strong>Quantity demanded expanded</strong>&rdquo;!
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Slide Footer */}
      <div
        className="flex items-center justify-between border-t pt-2.5 text-xs"
        style={{ borderColor: template.borderColor }}
      >
        <span className="font-mono font-bold" style={{ color: template.mutedColor }}>
          Slide {slideIdx + 1} of 4
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold" style={{ color: template.mutedColor }}>
            Consistent template identity across all slides
          </span>
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: template.paletteDot }}
          />
        </div>
      </div>
    </div>
  );
}
