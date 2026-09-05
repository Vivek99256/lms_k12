'use client';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import type { RiasecResultItem } from '../../_lib/types';

interface RiasecResultModalProps {
  item: RiasecResultItem | null;
  onOpenChange: (open: boolean) => void;
}

export function RiasecResultModal({ item, onOpenChange }: RiasecResultModalProps) {
  return (
    <Dialog open={Boolean(item)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item?.area}</DialogTitle>
          <DialogDescription className="text-sm leading-6 text-foreground">
            {item?.description}
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
