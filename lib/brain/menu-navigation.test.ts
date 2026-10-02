import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMenuTree, type ApiMenuItem } from '@/app/data/menuMappers';
import { isBrainMenu } from './menu-navigation';

function row(id: number, name: string, parent: number, level: number, link = 'javascript:void(0);'): ApiMenuItem {
  return { id, name, parent_menu_id: parent, level, link, status: 1, sort_order: id } as ApiMenuItem;
}

test('database Brain rows resolve landing pages and retain only returned Level 3 rights', () => {
  const [brain] = buildMenuTree(
    [row(854, 'Enterprise Brain', 0, 1)],
    { 854: { 40: row(855, 'Overview', 854, 2), 41: row(875, 'Automation', 854, 2), 42: row(876, 'Account/Settings', 854, 2) } },
    {
      855: { 100: row(860, 'Organization', 855, 3) },
      875: { 101: row(883, 'Agent Management', 875, 3, '/enterprise-brain/automation/agents') },
    },
  );

  assert.equal(isBrainMenu(brain), true);
  assert.equal(brain.id, 854);
  assert.equal(brain.href, '/enterprise-brain');
  const overview = brain.submenus![0];
  assert.equal(overview.href, '/enterprise-brain');
  assert.equal(overview.submenus![0].link, '/enterprise-brain');
  const automation = brain.submenus![1];
  assert.equal(automation.href, '/enterprise-brain/automation');
  assert.deepEqual(automation.submenus?.map((item) => item.id), [883]);
  assert.equal(automation.submenus![0].href, '/enterprise-brain/automation/agents');
  assert.equal(brain.submenus![2].href, '/enterprise-brain/settings');
  assert.equal(brain.submenus![2].submenus, undefined);
});

test('placeholder links in other modules are unchanged', () => {
  const [menu] = buildMenuTree([row(1, 'Other module', 0, 1)], {}, {});
  assert.equal(isBrainMenu(menu), false);
  assert.equal(menu.href, '#');
});
