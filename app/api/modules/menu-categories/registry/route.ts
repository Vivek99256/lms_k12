import type { NextRequest } from 'next/server';

import { proxyCategoryRequest } from '@/lib/laravel-category-proxy';

/**
 * Which modules have a category bar at all.
 *
 * Upstream:
 *   GET {LARAVEL_BASE_URL}/api/modules/menu-categories/registry
 *   next_lms_erp/routes/api.php → ModuleMenuCategoryApiController::registry
 *
 * The shell fetches this once per session to answer "does the level-2 menu the
 * user just selected have a bar, and under which module key?". Keeping it a
 * query rather than a constant is the point: seeding or retiring a module is a
 * row change, and a hardcoded list of 62 modules in the client would be wrong
 * the first time that happened.
 */
export async function GET(request: NextRequest) {
  return proxyCategoryRequest(request, {
    laravelPath: '/api/modules/menu-categories/registry',
    label: 'module category registry',
  });
}
