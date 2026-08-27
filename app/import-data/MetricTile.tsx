import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// Local reimplementation of the design system's MetricCard (K-12 ERP Design
// System: components/cards/MetricCard) — used here as compact result tiles.

type Tone = 'neutral' | 'success' | 'warning' | 'info' | 'error';

const TONE_STYLES: Record<Tone, { card: string; chip: string; value: string }> = {
  neutral: { card: 'border-slate-200', chip: 'bg-slate-100 text-slate-600', value: 'text-slate-900' },
  success: { card: 'border-emerald-200 bg-emerald-50', chip: 'bg-emerald-100 text-emerald-700', value: 'text-emerald-900' },
  warning: { card: 'border-amber-200 bg-amber-50', chip: 'bg-amber-100 text-amber-700', value: 'text-amber-900' },
  info: { card: 'border-blue-200 bg-blue-50', chip: 'bg-blue-100 text-blue-700', value: 'text-blue-900' },
  error: { card: 'border-red-200 bg-red-50', chip: 'bg-red-100 text-red-700', value: 'text-red-900' },
};

export default function MetricTile({
  icon: Icon,
  label,
  value,
  tone = 'neutral',
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone?: Tone;
}) {
  const styles = TONE_STYLES[tone];
  return (
    <div className={cn('rounded-xl border p-4', styles.card)}>
      <div className="flex items-center gap-2">
        <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-lg', styles.chip)}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <p className="text-xs font-medium text-slate-500">{label}</p>
      </div>
      <p className={cn('mt-2 font-mono text-2xl font-bold tabular-nums', styles.value)}>{value}</p>
    </div>
  );
}
