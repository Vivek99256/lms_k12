import type { CpFormatChoice, CpOptions, CpWorkflowFormat } from './api';

/** A format as the screen draws it: whether it can be picked, and why not. */
export interface FormatOption {
  key: string;
  label: string;
  selectable: boolean;
  note: string | null;
}

/**
 * The formats to show under a teaching method. When the server sent a compatibility map (the staged-workflow chapter),
 * only the formats compatible with the method are listed, and one without a generator is shown but cannot be picked.
 * For every other chapter the list is the unchanged one and nothing is hidden.
 */
export function formatOptions(options: CpOptions | null, method: string | null): FormatOption[] {
  if (options === null) return [];
  const map = options.workflow?.enabled ? options.workflow.formats_by_method : null;
  if (map === null) {
    return options.formats.map((f: CpFormatChoice) => ({ key: f.key, label: f.label, selectable: true, note: f.generator_exists ? null : '(no generator yet)' }));
  }
  if (method === null) return [];
  return (map[method] ?? []).map((f: CpWorkflowFormat) => ({
    key: f.key,
    label: f.name,
    selectable: f.available,
    note: f.available ? null : '(no generator yet)',
  }));
}

/** The format to keep after the method changed: the current one if still offered and selectable, otherwise none. */
export function formatAfterMethodChange(options: CpOptions | null, method: string | null, format: string | null): string | null {
  if (format === null || !options?.workflow?.enabled) return format;
  return formatOptions(options, method).some((f) => f.key === format && f.selectable) ? format : null;
}

export function usesWorkflow(options: CpOptions | null): boolean {
  return options?.workflow?.enabled === true;
}
