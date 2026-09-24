/** Resolves a dotted path ("student.name") against a fetched data object. Missing at any level -> undefined, never throws. */
export function resolveField(data: unknown, path: string | undefined): unknown {
  if (!path) return undefined;
  return path.split('.').reduce<unknown>((value, key) => {
    if (value && typeof value === 'object' && key in (value as Record<string, unknown>)) {
      return (value as Record<string, unknown>)[key];
    }
    return undefined;
  }, data);
}

/** {{token}} substitution against a form-values map, for a Button action's body mapping. */
export function resolveTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => values[key] ?? '');
}
