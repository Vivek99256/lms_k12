/**
 * Plain-language error text for end users.
 *
 * Backend and network error messages (HTTP codes, "Failed to fetch", stack
 * fragments) are not written for schools, so they are logged for support and
 * replaced with a friendly message. See docs/terminology-review.md §5.1.
 */
export const DEFAULT_ERROR_MESSAGE = "Couldn't complete that action. Please try again.";

export function friendlyError(error: unknown, fallback: string = DEFAULT_ERROR_MESSAGE): string {
  if (error) console.error(error);
  return fallback;
}
