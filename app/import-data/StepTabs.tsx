import type { LucideIcon } from 'lucide-react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StepTab = { label: string; description: string; icon: LucideIcon };

export default function StepTabs({ steps, current }: { steps: StepTab[]; current: number }) {
  return (
    <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white">
      {steps.map((item, idx) => {
        const isCompleted = idx < current;
        const isCurrent = idx === current;
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className={cn(
              'relative flex-1 border-r border-slate-200 px-5 py-4 last:border-r-0',
              isCurrent && 'bg-indigo-50/60'
            )}
          >
            <div
              className={cn(
                'flex size-9 items-center justify-center rounded-full',
                isCompleted && 'bg-indigo-600 text-white',
                isCurrent && 'bg-indigo-100 text-indigo-600',
                !isCompleted && !isCurrent && 'bg-slate-100 text-slate-400'
              )}
            >
              {isCompleted ? <Check className="size-4" /> : <Icon className="size-4" />}
            </div>
            <p className="mt-3 text-[13.5px] font-semibold text-slate-900">
              {idx + 1}. {item.label}
            </p>
            <p className="mt-1 text-xs leading-snug text-slate-500">{item.description}</p>
            {isCurrent && <div className="absolute inset-x-0 bottom-0 h-[3px] bg-indigo-600" />}
          </div>
        );
      })}
    </div>
  );
}
