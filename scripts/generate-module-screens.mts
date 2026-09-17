/**
 * Generates app/_lib/module-screens.generated.ts — the route -> page-component
 * map that lets a category tab render its screen inline instead of navigating
 * away.
 *
 * Why this is generated rather than written by hand: Fees and Teach/Learn each
 * maintain a hand-curated registry of a handful of routes, and that was
 * workable for two modules. Category bars now cover 64 modules and around 250
 * distinct screens, and a hand-written map that large would be wrong within a
 * week of anyone adding a page.
 *
 * Why it is generated app-wide rather than from the seeded category rows: the
 * rows change by UPDATE, with no deploy and no codegen step. A registry keyed
 * to them would silently stop covering a menu the moment someone moved one.
 * Every mountable page is included instead, so moving rows around never needs
 * a regeneration.
 *
 * Run:  node --import tsx scripts/generate-module-screens.mts
 *
 * Re-run it after adding a page that should be reachable as a category tab.
 * Nothing breaks if it is not re-run — an unlisted route simply keeps the old
 * behaviour and opens in its own page.
 */

import fs from 'node:fs';
import path from 'node:path';

const APP_DIR = 'app';
const OUT_FILE = path.join('app', '_lib', 'module-screens.generated.ts');

type Entry = { route: string; importPath: string };

/** A route group segment — '(marketing)' — is real on disk but not in the URL. */
function isRouteGroup(segment: string) {
  return segment.startsWith('(') && segment.endsWith(')');
}

/** A private folder — '_lib' — holds no routes. */
function isPrivate(segment: string) {
  return segment.startsWith('_');
}

function collect(dir: string, entries: Entry[]) {
  for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, dirent.name);

    if (dirent.isDirectory()) {
      if (dirent.name === 'node_modules' || dirent.name.startsWith('.')) continue;
      collect(full, entries);
      continue;
    }

    if (!/^page\.(tsx|ts|jsx)$/.test(dirent.name)) continue;

    const relDir = path.relative(APP_DIR, dir).split(path.sep).filter(Boolean);

    // Dynamic segments need params this component cannot supply, api/ holds no
    // pages, and private folders hold no routes.
    if (relDir.some((s) => s.includes('[') || isPrivate(s))) continue;
    if (relDir[0] === 'api') continue;

    const source = fs.readFileSync(full, 'utf8');

    // An async default export is a server component; next/dynamic with
    // ssr:false cannot mount one.
    if (/export\s+default\s+async\s+function/.test(source)) continue;

    // A redirect stub renders nothing — its default export returns void, so it
    // is not a component at all. Two exist (app/pal/framework/ulu,
    // app/students/leave) and both forward to a real page that is listed here
    // on its own. Mounting one would render an empty tab.
    if (/\bredirect\s*\(/.test(source) && /from\s+['"]next\/navigation['"]/.test(source)) continue;

    // `metadata` and `generateMetadata` are server-only exports. Importing such
    // a page from a client component is a hard build error, not a warning —
    // app/pal/pedagogy-engine failed the build exactly this way. The page keeps
    // working at its own route; it just cannot be mounted in a tab.
    if (/export\s+(const\s+metadata|async\s+function\s+generateMetadata|function\s+generateMetadata)/.test(source)) {
      continue;
    }

    // A category page must never be mountable inside a category page.
    if (source.includes('ModuleCategoryPage')) continue;

    const route = '/' + relDir.filter((s) => !isRouteGroup(s)).join('/');
    if (route === '/') continue;

    entries.push({
      route: route.toLowerCase(),
      importPath: '@/' + path.posix.join(APP_DIR, ...relDir, 'page'),
    });
  }
}

const entries: Entry[] = [];
collect(APP_DIR, entries);

// A route group can make two directories resolve to the same URL. Keep the
// first and report the rest rather than emitting a duplicate object key.
const byRoute = new Map<string, Entry>();
const duplicates: string[] = [];

for (const entry of entries) {
  if (byRoute.has(entry.route)) {
    duplicates.push(entry.route);
    continue;
  }
  byRoute.set(entry.route, entry);
}

const sorted = [...byRoute.values()].sort((a, b) => a.route.localeCompare(b.route));

const body = sorted
  .map((e) => `  '${e.route}': screen(() => import('${e.importPath}')),`)
  .join('\n');

const output = `// GENERATED FILE — do not edit by hand.
// Regenerate with: node --import tsx scripts/generate-module-screens.mts
// See scripts/generate-module-screens.mts for what is included and why.
'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

/** Every page below is a prop-less page component. */
type ScreenComponent = ComponentType<object>;

function screen(loader: () => Promise<{ default: ScreenComponent }>): ScreenComponent {
  return dynamic(loader, { ssr: false });
}

/**
 * Route -> page component, for every page in this app that can be mounted
 * inside a category tab. ${sorted.length} entries.
 */
export const GENERATED_MODULE_SCREENS: Record<string, ScreenComponent> = {
${body}
};
`;

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, output);

console.log(`wrote ${OUT_FILE} with ${sorted.length} routes`);
if (duplicates.length > 0) {
  console.log(`skipped ${duplicates.length} duplicate route(s): ${duplicates.slice(0, 5).join(', ')}`);
}
