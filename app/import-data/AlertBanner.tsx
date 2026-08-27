import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Local reimplementation of the design system's AlertBanner (K-12 ERP Design
// System: components/feedback/AlertBanner). Every variant pairs a hue with a
// distinct icon so status is never carried by color alone.

type Variant = 'info' | 'success' | 'warning' | 'error';

const VARIANT_STYLES: Record<Variant, { icon: typeof Info; classes: string; iconClasses: string }> = {
  info: { icon: Info, classes: 'border-blue-200 bg-blue-50 text-blue-800', iconClasses: 'text-blue-600' },
  success: { icon: CheckCircle2, classes: 'border-emerald-200 bg-emerald-50 text-emerald-800', iconClasses: 'text-emerald-600' },
  warning: { icon: AlertTriangle, classes: 'border-amber-200 bg-amber-50 text-amber-800', iconClasses: 'text-amber-600' },
  error: { icon: XCircle, classes: 'border-red-200 bg-red-50 text-red-800', iconClasses: 'text-red-600' },
};

export default function AlertBanner({
  variant,
  title,
  children,
  onDismiss,
}: {
  variant: Variant;
  title?: string;
  children: React.ReactNode;
  onDismiss?: () => void;
}) {
  const { icon: Icon, classes, iconClasses } = VARIANT_STYLES[variant];
  return (
    <div role={variant === 'error' ? 'alert' : 'status'} className={cn('flex items-start gap-3 rounded-xl border px-4 py-3 text-sm', classes)}>
      <Icon className={cn('mt-0.5 size-4 shrink-0', iconClasses)} aria-hidden="true" />
      <div className="flex-1">
        {title && <p className="font-semibold">{title}</p>}
        <p className={title ? 'mt-0.5' : undefined}>{children}</p>
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="shrink-0 rounded-md p-0.5 hover:bg-black/5">
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
