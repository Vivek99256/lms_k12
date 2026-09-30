/**
 * V1 quality gate: no sidebar link may lead to a page that does not exist.
 *
 * The sidebar is built from the `tblmenumaster` table of whichever school is logged in, so
 * whether a link is dead depends on that school's rows, not on this repo alone. This script
 * takes an export of the active menu rows, runs each through the SAME functions the sidebar
 * uses (mapApiLinkToRoute + isVisibleMenuLink), and fails if any link the sidebar would show
 * resolves to a route with no page.tsx.
 *
 *   # 1. export the rows (Laravel repo, read-only):
 *   #    select id, level, name, link from tblmenumaster
 *   #    where status = 1 and link is not null and link <> ''
 *   #    -> save as JSON: [{"id":1,"level":2,"name":"...","link":"..."}, ...]
 *   # 2. run it here:
 *   npx tsx scripts/check-menu-links.ts path/to/menu-links.json
 *
 * Exit code 1 when a visible link is dead, so it can gate a release.
 */
import fs from 'node:fs';
import path from 'node:path';

import { mapApiLinkToRoute } from '../app/data/routeMapper';
import { isVisibleMenuLink } from '../app/data/menuMappers';

type MenuRow = { id: number; level?: number; name?: string; link: string };

const appDir = path.join(process.cwd(), 'app');
const pages: string[][] = [];

function walk(dir: string) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/^page\.(tsx|ts|jsx)$/.test(entry.name)) {
      const segments = path
        .relative(appDir, dir)
        .split(path.sep)
        .filter((segment) => segment && !/^\(.*\)$/.test(segment));
      pages.push(segments.map((segment) => (segment.startsWith('[') ? '*' : segment)));
    }
  }
}
walk(appDir);

const pageExists = (route: string) => {
  const segments = route.split(/[?#]/)[0].split('/').filter(Boolean);
  return pages.some((page) => page.length === segments.length && page.every((part, i) => part === '*' || part === segments[i]));
};

const file = process.argv[2];
if (!file) {
  console.error('usage: npx tsx scripts/check-menu-links.ts <menu-links.json>');
  process.exit(2);
}

const rows = JSON.parse(fs.readFileSync(file, 'utf8')) as MenuRow[];
let shown = 0;
const dead: string[] = [];

for (const row of rows) {
  const route = mapApiLinkToRoute(row.link);
  if (route === '#' || /^https?:/.test(route)) continue;
  if (!isVisibleMenuLink(row.link)) continue;
  shown++;
  if (!pageExists(route)) dead.push(`L${row.level ?? '?'} #${row.id} "${row.name ?? ''}"  ${row.link}  ->  ${route}`);
}

console.log(`${rows.length} menu rows, ${shown} would be shown, ${dead.length} lead to a missing page`);
for (const line of dead) console.log('  DEAD ' + line);
process.exit(dead.length ? 1 : 0);
