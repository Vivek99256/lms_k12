/**
 * The Fees module's key in the platform-services registry.
 *
 * ONE SPELLING, ONE PLACE. Fees now mounts three of the central consoles —
 * notifications under Fees → Communication, and workflow and scheduler under
 * Fees → Dashboard — and each of them scopes its request with this key. A typo
 * in one of them would not fail loudly: the API would answer with an empty
 * scope, and the screen would say Fees has nothing configured, which is the
 * worst kind of wrong answer because it looks like a settled one.
 *
 * The key itself is declared by Laravel in config/platform_services.php and
 * served by GET /api/platform/registry. This constant only names it; it does
 * not define it, and nothing here may invent a module the registry has not.
 */
export const FEES_PLATFORM_MODULE = 'fees';
