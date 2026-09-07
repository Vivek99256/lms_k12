import type { ComponentType } from 'react';
import { Badge } from '@/components/ui/badge';

interface CareerExplorerPageHeaderProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  badgeIcon: ComponentType<{ className?: string }>;
  badgeLabel: string;
}

/** Shared header for every Career Explorer sub-page — keeps them visually consistent with Find Occupation. */
export function CareerExplorerPageHeader({ icon: Icon, title, description, badgeIcon: BadgeIcon, badgeLabel }: CareerExplorerPageHeaderProps) {
  return (
    <header className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-[#0D6EFD]">
            <span className="flex size-6 items-center justify-center rounded-md bg-[#0D6EFD]/10">
              <Icon className="size-3.5" />
            </span>
            Career explorer
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
        </div>
        <Badge variant="outline" className="border-[#0D6EFD]/20 bg-[#0D6EFD]/10 text-[#0D6EFD]">
          <BadgeIcon className="size-3.5" />
          {badgeLabel}
        </Badge>
      </div>
    </header>
  );
}
