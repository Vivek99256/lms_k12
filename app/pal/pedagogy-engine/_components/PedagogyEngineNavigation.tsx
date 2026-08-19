'use client';

import {
  Activity,
  Braces,
  Gauge,
  Layers,
  Route as RouteIcon,
  ShieldAlert,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';
import type { PedagogySection } from '@/app/pal/data/pedagogy-engine';

const SECTION_ICONS: Record<string, LucideIcon> = {
  'tier-1': Layers,
  'tier-2': Activity,
  'tier-3': ShieldAlert,
  'tier-4': SlidersHorizontal,
  'tier-5': Braces,
  'engagement-score': Gauge,
  'trigger-map': RouteIcon,
};

function sectionIcon(id: string): LucideIcon {
  return SECTION_ICONS[id] ?? Braces;
}

function sectionCount(section: PedagogySection) {
  if (section.type === 'signals') return (section.signals?.length ?? 0) + (section.interpretation?.length ?? 0);
  if (section.type === 'triggers') return section.triggers?.length ?? 0;
  return section.rules.length;
}

function statusTone(status: string | null) {
  const value = (status ?? '').toLowerCase();
  if (value === 'implemented') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (value.includes('partial')) return 'bg-amber-50 text-amber-700 ring-amber-200';
  return 'bg-slate-100 text-slate-600 ring-slate-200';
}

export default function PedagogyEngineNavigation({
  sections,
  activeId,
  onSelect,
}: {
  sections: PedagogySection[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <nav aria-label="Pedagogy Engine submodules" className="lg:sticky lg:top-4">
      <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-[linear-gradient(180deg,#f5f3ff_0%,#ffffff_100%)] px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-600">Submodules</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{sections.length} rule groups</p>
        </div>

        <ul className="flex gap-2 overflow-x-auto p-3 lg:block lg:space-y-2 lg:overflow-visible lg:p-3">
          {sections.map((section, index) => {
            const Icon = sectionIcon(section.id);
            const isActive = section.id === activeId;

            return (
              <li key={section.id} className="shrink-0 lg:shrink">
                <button
                  type="button"
                  onClick={() => onSelect(section.id)}
                  aria-current={isActive ? 'true' : undefined}
                  className={`flex w-64 items-start gap-3 rounded-2xl border px-3 py-3 text-left transition lg:w-full ${
                    isActive
                      ? 'border-violet-300 bg-violet-50/70 shadow-sm'
                      : 'border-transparent bg-slate-50/70 hover:border-slate-200 hover:bg-white'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      isActive ? 'bg-violet-600 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          isActive ? 'bg-violet-600 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200'
                        }`}
                      >
                        {sectionCount(section)}
                      </span>
                    </span>
                    <span className={`mt-1 block text-sm font-semibold ${isActive ? 'text-violet-900' : 'text-slate-900'}`}>
                      {section.name}
                    </span>
                    {section.implementation_status ? (
                      <span
                        className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${statusTone(
                          section.implementation_status
                        )}`}
                      >
                        {section.implementation_status}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
