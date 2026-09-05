'use client';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import type { RiasecResultItem } from '../../_lib/types';
import { getAreaMeta } from './riasecMeta';

interface RiasecResultModalProps {
  item: RiasecResultItem | null;
  onOpenChange: (open: boolean) => void;
}

export function RiasecResultModal({ item, onOpenChange }: RiasecResultModalProps) {
  const meta = item ? getAreaMeta(item.area) : null;
  const Icon = meta?.icon;

  return (
    <Dialog open={Boolean(item)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {Icon && meta && (
              <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${meta.iconClass}`}>
                <Icon className="size-4" />
              </span>
            )}
            {item?.area}
            {item && <span className="ml-auto text-base font-normal text-muted-foreground">Score {item.score}</span>}
          </DialogTitle>
          <DialogDescription className="text-sm leading-6 text-foreground">
            {item?.description}
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
