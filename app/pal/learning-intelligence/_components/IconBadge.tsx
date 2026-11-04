import type { LucideIcon } from 'lucide-react';
import { ACCENT, type AccentKey } from './design-system';

const SIZES = {
  sm: { box: 'h-8 w-8 rounded-lg', icon: 'h-4 w-4' },
  md: { box: 'h-10 w-10 rounded-xl', icon: 'h-5 w-5' },
  lg: { box: 'h-12 w-12 rounded-xl', icon: 'h-6 w-6' },
} as const;

/** A colourful gradient icon badge — the one recurring accent element used on every page header and section title in this module. */
export default function IconBadge({
  icon: Icon,
  accent = 'brand',
  size = 'md',
}: {
  icon: LucideIcon;
  accent?: AccentKey;
  size?: keyof typeof SIZES;
}) {
  const { gradient } = ACCENT[accent];
  const { box, icon } = SIZES[size];
  return (
    <span className={`flex shrink-0 items-center justify-center bg-gradient-to-br ${gradient} ${box} text-white shadow-sm`}>
      <Icon className={icon} />
    </span>
  );
}
