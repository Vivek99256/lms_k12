/**
 * The shape of the module category feed, as `/api/module-menu-categories`
 * returns it.
 *
 * ── THE FEED MUST CARRY `modules` AND `module`, NOT JUST `categories` ───────
 *
 * This is the failure this type exists to make impossible to forget. The
 * controller once returned `categories` alone, and every
 * `/modules/<slug>/intelligence` route then answered "No such module" while
 * still returning 200 with a correct-looking category list — so nothing looked
 * broken anywhere.
 *
 *   - the menu tree reads `modules` to map a level-2 id to a module slug;
 *   - the Intelligence screen reads `module.label` / `module.link` to run the
 *     registry matcher.
 *
 * Both are asked for with no module named, so the directory has to be on the
 * early-return path too. Pinned server-side by
 * `test_the_feed_always_carries_the_directory_and_the_resolved_module`.
 */

/** One row of the module directory: every module this tenant has, by slug. */
export type ModuleDirectoryEntry = {
  /** `fees_menu_categories.module_name` — the slug used in `/modules/<slug>/…`. */
  moduleName: string;
  /** The level-2 `tblmenumaster.id` this module hangs off, when it has one. */
  level2MenuId: number | null;
  label: string;
  /** The level-2 row's legacy `link`, which the registry matcher also reads. */
  link: string;
};

/** One level-3 menu inside a category. */
export type ModuleCategoryFeedItem = {
  id?: number;
  label: string;
  link: string;
};

/** One category of the module's bar. */
export type ModuleCategoryFeedEntry = {
  key: string;
  label: string;
  description: string;
  /**
   * The category's configured page, from its own row. Empty is legitimate and
   * resolves to the canonical `/modules/<slug>/<category>` instead of being
   * treated as a broken row.
   */
  route: string;
  items: ModuleCategoryFeedItem[];
};

export type ModuleCategoriesResponse = {
  /** Every module this tenant has. Present even when no module was named. */
  modules: ModuleDirectoryEntry[];
  /**
   * The module the request resolved to, or null when the slug matched none.
   *
   * NULL IS A REAL ANSWER, not an error: a slug this tenant does not have must
   * produce no navigation rather than a bar pointing at another module's pages.
   */
  module: ModuleDirectoryEntry | null;
  categories: ModuleCategoryFeedEntry[];
};
