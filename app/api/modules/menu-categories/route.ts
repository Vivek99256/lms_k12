import type { NextRequest } from 'next/server';

import { proxyCategoryRequest } from '@/lib/laravel-category-proxy';

/**
 * One module's category bar, for every module except Fees and Teach/Learn —
 * those keep their own routes because their clients already call them by name.
 *
 * Upstream:
 *   GET {LARAVEL_BASE_URL}/api/modules/menu-categories
 *   next_lms_erp/routes/api.php → ModuleMenuCategoryApiController::index
 *
 * `level2_menu_id` identifies the module and `module_name` is the fallback for
 * a caller that knows the slug; the backend prefers the id because two active
 * level-2 menus share the name "Task Management".
 */
export async function GET(request: NextRequest) {
  return proxyCategoryRequest(request, {
    laravelPath: '/api/modules/menu-categories',
    label: 'module menu-categories',
    forwardParams: ['module_name', 'level2_menu_id'],
  });
}
