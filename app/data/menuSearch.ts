/**
 * Search index over the rights-filtered menu tree.
 *
 * The tree the sidebar renders is the only list of screens this user is allowed
 * to reach, so the top-bar search is built from exactly that — never from a
 * hard-coded route list, which would offer screens the user's profile has no
 * rights to.
 *
 * Level 1 (top category) -> Level 2 (module) -> Level 3 (screen). An entry is
 * only navigable if it resolves to a real route, or — for a Level 2 module —
 * if it has Level 3 children the shell can fall through to.
 */
import type { Level3Item, MenuItem, SubmenuItem } from '@/app/data/menuItems';
import { mapApiLinkToRoute } from '@/app/data/routeMapper';
import { resolveModuleDashboardRoute } from '@/app/data/moduleDashboards';

export interface MenuSearchEntry {
  key: string;
  level: 1 | 2 | 3;
  label: string;
  /** Resolved Next.js route, or '' for a Level 2 module that lands on its first child. */
  route: string;
  /** Ancestor labels, outermost first — shown as the result's breadcrumb. */
  trail: string[];
  level1Key: string;
  level2Key: string;
  /** Kept so the shell can reuse its normal Level 2 selection flow verbatim. */
  level1?: MenuItem;
  level2?: SubmenuItem;
}

export interface MenuSearchResult {
  entry: MenuSearchEntry;
  score: number;
}

function menuKey(item: { id?: number | string; label: string; href?: string }) {
  return String(item.id ?? item.href ?? item.label);
}

/** The API sends either a legacy route name (`link`) or a path (`href`); `link` wins. */
function resolveRoute(item: { link?: string | null; href?: string }): string {
  const fromLink = item.link ? mapApiLinkToRoute(item.link) : '';
  if (fromLink && fromLink !== '#') return fromLink;
  const href = item.href ?? '';
  return href && href !== '#' ? href : '';
}

export function buildMenuSearchIndex(menuItems: MenuItem[]): MenuSearchEntry[] {
  const entries: MenuSearchEntry[] = [];
  const seen = new Set<string>();

  const push = (entry: MenuSearchEntry) => {
    // Modules repeat across categories in some profiles; keep the first only.
    const dedupeKey = `${entry.level}|${entry.label.toLowerCase()}|${entry.route}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    entries.push(entry);
  };

  for (const level1 of menuItems) {
    const level1Key = menuKey(level1);
    const level1Route = resolveRoute(level1);

    if (level1Route) {
      push({
        key: `l1:${level1Key}`,
        level: 1,
        label: level1.label,
        route: level1Route,
        trail: [],
        level1Key,
        level2Key: '',
        level1,
      });
    }

    for (const level2 of level1.submenus ?? []) {
      const level2Key = menuKey(level2);
      // A module with a dashboard lands there first, matching a sidebar click.
      const level2Route = resolveModuleDashboardRoute(level2.label) ?? resolveRoute(level2);
      const hasChildren = Boolean(level2.submenus?.length);

      if (level2Route || hasChildren) {
        push({
          key: `l2:${level1Key}:${level2Key}`,
          level: 2,
          label: level2.label,
          route: level2Route,
          trail: [level1.label],
          level1Key,
          level2Key,
          level1,
          level2,
        });
      }

      for (const level3 of (level2.submenus ?? []) as Level3Item[]) {
        const level3Route = resolveRoute(level3);
        if (!level3Route) continue;
        push({
          key: `l3:${level1Key}:${level2Key}:${menuKey(level3)}`,
          level: 3,
          label: level3.label,
          route: level3Route,
          trail: [level1.label, level2.label],
          level1Key,
          level2Key,
          level1,
          level2,
        });
      }
    }
  }

  return entries;
}

const WORD_SEPARATORS = /[\s/\-_(),.&]+/;

function normalize(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Score one entry against one search token. Earlier and more complete matches
 * on the entry's own label beat matches that only land in its breadcrumb, so
 * "fees" ranks the Fees module above every screen filed under it.
 */
function scoreToken(label: string, trail: string, token: string): number {
  if (label === token) return 1000;
  if (label.startsWith(token)) return 600;

  // "entry" should still find "Fees Entry" — a match at any word boundary of the
  // label beats one buried mid-word. Split rather than build a regex, since menu
  // labels carry brackets and slashes that would need escaping.
  const wordStart = label.split(WORD_SEPARATORS).some((word) => word.startsWith(token));
  if (wordStart) return 400;
  if (label.includes(token)) return 200;
  if (trail.includes(token)) return 60;
  return 0;
}

export function searchMenuIndex(
  index: MenuSearchEntry[],
  query: string,
  limit = 12
): MenuSearchResult[] {
  const normalizedQuery = normalize(query);
  if (normalizedQuery.length < 2) return [];

  const tokens = normalizedQuery.split(' ');
  const results: MenuSearchResult[] = [];

  for (const entry of index) {
    const label = normalize(entry.label);
    const trail = normalize(entry.trail.join(' '));

    let score = 0;
    let matchedAll = true;
    for (const token of tokens) {
      const tokenScore = scoreToken(label, trail, token);
      if (!tokenScore) {
        matchedAll = false;
        break;
      }
      score += tokenScore;
    }
    if (!matchedAll) continue;

    // Within one match tier, the shorter label is the closer match — typing
    // "fee" should offer the Fees module before "Fees Late Master". Depth is
    // only a final nudge toward the leaf, never enough to outrank a tier or a
    // markedly tighter label.
    score -= Math.min(label.length, 60) * 1.5;
    score += entry.level * 3;

    results.push({ entry, score });
  }

  results.sort((a, b) => b.score - a.score || a.entry.label.localeCompare(b.entry.label));
  return results.slice(0, limit);
}

/** Split a label into alternating plain/highlighted pieces for the query tokens. */
export function highlightSegments(label: string, query: string): { text: string; match: boolean }[] {
  const tokens = normalize(query).split(' ').filter(Boolean);
  if (!tokens.length) return [{ text: label, match: false }];

  const lower = label.toLowerCase();
  const flags = new Array<boolean>(label.length).fill(false);

  for (const token of tokens) {
    let from = 0;
    for (;;) {
      const at = lower.indexOf(token, from);
      if (at === -1) break;
      for (let i = at; i < at + token.length; i += 1) flags[i] = true;
      from = at + token.length;
    }
  }

  const segments: { text: string; match: boolean }[] = [];
  for (let i = 0; i < label.length; i += 1) {
    const last = segments[segments.length - 1];
    if (last && last.match === flags[i]) last.text += label[i];
    else segments.push({ text: label[i], match: flags[i] });
  }
  return segments;
}
