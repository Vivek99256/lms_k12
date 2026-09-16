import {
  ClipboardList, HeartHandshake, Lightbulb, Microscope, TrendingUp, Wrench, type LucideIcon,
} from 'lucide-react';

/**
 * Direct color classes (no `--primary`/`--success`/`--warning` design tokens),
 * matching the TONE convention already established in
 * app/career-intelligence/_components/CareerIntelligence.tsx.
 */
interface RiasecAreaMeta {
  icon: LucideIcon;
  chartColor: string;
  iconClass: string;
  badgeClass: string;
  dot: string;
}

const RIASEC_AREA_META: Record<string, RiasecAreaMeta> = {
  realistic: {
    icon: Wrench,
    chartColor: '#64748b',
    iconClass: 'bg-slate-100 text-slate-600',
    badgeClass: 'border-slate-200 bg-slate-50 text-slate-600',
    dot: 'bg-slate-500',
  },
  investigative: {
    icon: Microscope,
    chartColor: '#0284c7',
    iconClass: 'bg-sky-50 text-sky-600',
    badgeClass: 'border-sky-200 bg-sky-50 text-sky-600',
    dot: 'bg-sky-500',
  },
  artistic: {
    icon: Lightbulb,
    chartColor: '#7c3aed',
    iconClass: 'bg-violet-50 text-violet-600',
    badgeClass: 'border-violet-200 bg-violet-50 text-violet-600',
    dot: 'bg-violet-500',
  },
  social: {
    icon: HeartHandshake,
    chartColor: '#059669',
    iconClass: 'bg-emerald-50 text-emerald-600',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-600',
    dot: 'bg-emerald-500',
  },
  enterprising: {
    icon: TrendingUp,
    chartColor: '#d97706',
    iconClass: 'bg-amber-50 text-amber-600',
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
    dot: 'bg-amber-500',
  },
  conventional: {
    icon: ClipboardList,
    chartColor: '#4F46E5',
    iconClass: 'bg-indigo-50 text-[#4F46E5]',
    badgeClass: 'border-indigo-200 bg-indigo-50 text-[#4F46E5]',
    dot: 'bg-[#4F46E5]',
  },
};

const FALLBACK_META: RiasecAreaMeta = {
  icon: Lightbulb,
  chartColor: '#64748b',
  iconClass: 'bg-slate-100 text-slate-600',
  badgeClass: 'border-slate-200 bg-slate-50 text-slate-600',
  dot: 'bg-slate-500',
};

/** Keyed by area name (case-insensitive) rather than array position, so
 * chart segments and score tiles always agree on color even if the API
 * ever returns areas in a different order. */
export function getAreaMeta(area: string): RiasecAreaMeta {
  return RIASEC_AREA_META[area.trim().toLowerCase()] ?? FALLBACK_META;
}
