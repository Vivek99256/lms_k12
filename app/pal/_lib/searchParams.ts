/**
 * Search-param helpers shared by the PAL taxonomy routes.
 *
 * `queryStringFromSearchParams` was copy-pasted verbatim into five route files
 * (framework, frameworks, frameworks/[slug], ulu, ulu/[slug]). Five identical
 * copies of the same 13 lines is five places to fix when the chapter/concept
 * context needs another key, so it lives here once.
 */

export type RouteSearchParams = Record<string, string | string[] | undefined>;

/**
 * Re-serialise Next's resolved searchParams, preserving repeated keys.
 *
 * Empty values are dropped rather than emitted as `key=`, so a context-free
 * URL stays clean instead of accumulating bare separators.
 */
export function queryStringFromSearchParams(searchParams: RouteSearchParams): string {
  const query = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry) query.append(key, entry);
      });
      return;
    }
    if (value) query.set(key, value);
  });

  return query.toString();
}

/**
 * The single value for a key that Next may hand back as a repeated param.
 *
 * The routes only ever act on one chapterId/concept, so a repeated key takes
 * the first rather than being rejected — matching the behaviour these routes
 * already had when each of them inlined this ternary.
 */
export function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
