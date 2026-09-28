'use client';

/**
 * "Select a module" for the central AI & Intelligence console.
 *
 * WHY THIS EXISTS
 *
 * No reusable module selector existed anywhere under `/ai/*` — each screen that touched
 * a module concept at all (Policies, before this) fetched the list and then never wired
 * it to anything. This is the one place that changes: every central screen that gains a
 * per-module view (Policies, Models, Usage & Cost, Guardrails, Activity) renders the
 * same picker, backed by the same `ai_modules` list `fetchAiPolicyOptions()` already
 * returns — no new endpoint, no second module catalogue.
 *
 * WHAT SELECTING A MODULE DOES, AND WHAT IT DOES NOT DO
 *
 * Selecting "Fees" here does not navigate anywhere. Each screen that embeds this picker
 * reads the selection and calls the exact same per-module endpoint (`/modules/{key}/...`)
 * the module's own AI Stack tab calls — so the data shown is the same row, live, without
 * a redirect in either direction. This component only ever emits a module key; it has no
 * opinion about what the screen around it does with it.
 */

/** The minimal shape every module list this app has (`AiPolicyModuleOption`, `TemplateModule`, …) already satisfies. */
export interface ModulePickerOption {
  key: string;
  label: string;
}

export function ModulePicker({
  modules,
  value,
  onChange,
  allowAll = true,
  loading = false,
  className = '',
}: {
  modules: ModulePickerOption[];
  /** Empty string means "All modules" (only meaningful when `allowAll`). */
  value: string;
  onChange: (moduleKey: string) => void;
  /** Whether an unscoped "All modules" option is offered. Screens with no sensible
   *  "all" reading (Models overrides, Guardrails) set this false and must supply an
   *  initial non-empty `value`. */
  allowAll?: boolean;
  loading?: boolean;
  className?: string;
}) {
  const sorted = [...modules].sort((a, b) => a.label.localeCompare(b.label));

  return (
    <select
      value={value}
      disabled={loading || sorted.length === 0}
      onChange={(event) => onChange(event.target.value)}
      className={`h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 disabled:opacity-60 ${className}`}
    >
      {allowAll && <option value="">All modules</option>}
      {!allowAll && value === '' && <option value="">Select a module…</option>}
      {sorted.map((module) => (
        <option key={module.key} value={module.key}>
          {module.label}
        </option>
      ))}
    </select>
  );
}
