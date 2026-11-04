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
  size = 'default',
}: {
  title: string;
  icon?: LucideIcon;
  accent?: AccentKey;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  size?: 'default' | 'lg';
}) {
  const { solid, text, bg } = ACCENT[accent];
  const isLg = size === 'lg';
  return (
    <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className={`${isLg ? 'h-1.5' : 'h-1'} w-full ${solid}`} />
      <div className={`flex items-center justify-between gap-3 ${isLg ? 'px-6 pt-5' : 'px-4 pt-3.5'}`}>
        <h3
          className={`flex items-center gap-2 font-bold uppercase tracking-widest text-slate-500 ${
            isLg ? 'text-sm' : 'text-xs'
          }`}
        >
          {Icon ? (
            <span
              className={`flex items-center justify-center rounded-lg ${bg} ${text} ${
                isLg ? 'h-8 w-8' : 'h-6 w-6'
              }`}
            >
              <Icon className={isLg ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
            </span>
          ) : null}
          {title}
        </h3>
        {action}
      </div>
      <div className={isLg ? 'p-6 pt-4' : 'p-4 pt-3'}>{children}</div>
    </div>
  );
}
