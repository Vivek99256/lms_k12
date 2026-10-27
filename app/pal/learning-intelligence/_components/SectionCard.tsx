import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ACCENT, type AccentKey } from './design-system';

/**
 * The one card chrome every sidebar/panel section in this module uses:
 * white surface, a coloured icon chip next to the title, a thin coloured
 * top accent bar. Reused by the legend, the scope/class pickers, the AI
 * overlay toggle, the roster, the misconceptions board — so the module
 * reads as one designed system instead of each panel inventing its own
 * header treatment.
 */
export default function SectionCard({
  title,
  icon: Icon,
  accent = 'brand',
  action,
  children,
  className = '',
}: {
  title: string;
  icon?: LucideIcon;
  accent?: AccentKey;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const { solid, text, bg } = ACCENT[accent];
  return (
    <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className={`h-1 w-full ${solid}`} />
      <div className="flex items-center justify-between gap-3 px-4 pt-3.5">
        <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
          {Icon ? (
            <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${bg} ${text}`}>
              <Icon className="h-3.5 w-3.5" />
            </span>
          ) : null}
          {title}
        </h3>
        {action}
      </div>
      <div className="p-4 pt-3">{children}</div>
    </div>
  );
}
