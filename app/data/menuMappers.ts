import {
  LayoutDashboard, User, Banknote, Calendar, FileText,
  BarChart3, MessageSquare, Settings, BookOpen, ClipboardList,
  UserPlus, FileCheck, Menu
} from 'lucide-react';
import type { ComponentType } from 'react';
import { MenuItem, SubmenuItem, Level3Item } from './menuItems';
import { createMdIcon } from '@/app/components/MdIcon';

export interface ApiMenuItem {
  id: number;
  name: string;
  menu_title: string | null;
  menu_sortorder: string | null;
  description: string;
  parent_menu_id: number;
  level: number;
  status: number;
  sort_order: number;
  link: string | null;
  icon: string | null;
  sub_institute_id: string;
  client_id: string;
  created_at: string;
  updated_at: string;
  menu_type: string | null;
  database_table: string | null;
  site_map_name: string;
  youtube_link: string | null;
  pdf_link: string | null;
  menu_path: string;
  quick_menu: string | null;
  dashboard_menu: string | null;
  text: string | null;
}

type MenuIcon = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
type ApiMenuGroup = Record<string, ApiMenuItem[] | ApiMenuItem | Record<string, ApiMenuItem>>;
export type ApiMenuGroups = Record<string, ApiMenuGroup | ApiMenuItem[] | ApiMenuItem>;

const ICON_MAP: Record<string, MenuIcon> = {
  'mdi mdi-account fa-fw': User,
  'mdi mdi-cash-100 fa-fw': Banknote,
  calendar: Calendar,
  'file-text': FileText,
  'bar-chart-3': BarChart3,
  'message-square': MessageSquare,
  settings: Settings,
  'book-open': BookOpen,
  'clipboard-list': ClipboardList,
  'user-plus': UserPlus,
  'file-check': FileCheck,
  dashboard: LayoutDashboard,
  menu: Menu,
};

function resolveIcon(iconStr: string | null, level: number): MenuIcon {
  if (!iconStr) {
    return level === 1 ? LayoutDashboard : level === 2 ? BookOpen : FileText;
  }

  const key = iconStr.trim().toLowerCase();
  if (ICON_MAP[key]) return ICON_MAP[key];

  const partial = Object.keys(ICON_MAP).find(k => key.includes(k));
  if (partial) return ICON_MAP[partial];

  // Use MDI icon for any icon string (converts "school" to "mdi mdi-school")
  const mdiIcon = createMdIcon(iconStr);
  if (mdiIcon) return mdiIcon;

  return level === 1 ? LayoutDashboard : level === 2 ? BookOpen : FileText;
}

const ROUTE_MAP: Record<string, string> = {
   'dashboard.index': '/dashboard',
   'student.index': '/students',
   'fees_collect.index': '/fees/collect',
   'institute.index': '/institute',
 };

export function resolveRoute(link: string | null): string {
  if (!link) return '/';
  const clean = link.trim();
  if (clean === 'javascript:void(0);' || clean === 'javascript:void(0)') return '#';
  const lower = clean.toLowerCase();
  if (ROUTE_MAP[lower]) return ROUTE_MAP[lower];
  if (lower === '/admission-enquiry') return '/admission-enquiry';
  if (lower === '/admission-registration') return '/admission-registration';
  if (lower === '/admission-confirmation') return '/admission-confirmation';
  if (lower.startsWith('/')) return clean;
  const fallback = lower
    .replace(/\.index$/i, '')
    .replace(/\./g, '/')
    .replace(/_/g, '-')
    .replace(/\/+$/g, '');
  return '/' + fallback;
}

function isApiMenuItem(value: unknown): value is ApiMenuItem {
  return Boolean(value && typeof value === 'object' && 'id' in value && 'name' in value);
}

function flattenMenuGroup(value: unknown): ApiMenuItem[] {
   if (!value) return [];
   if (Array.isArray(value)) return value.filter(isApiMenuItem);
   if (isApiMenuItem(value)) return [value];
   if (typeof value !== 'object') return [];

   const obj = value as Record<string, unknown>;
   
  if (obj['0']) {
      const zero = obj['0'];
      if (Array.isArray(zero)) {
        return zero.filter(isApiMenuItem);
      }
      if (isApiMenuItem(zero)) {
        const results: ApiMenuItem[] = [zero];
        for (const key of Object.keys(obj)) {
          if (key === '0') continue;
          const v = obj[key];
          if (!v) continue;
          if (isApiMenuItem(v)) {
            results.push(v);
          } else if (Array.isArray(v)) {
            results.push(...v.filter(isApiMenuItem));
          } else if (typeof v === 'object') {
            const nested = flattenMenuGroup(v);
            results.push(...nested);
          }
        }
        return results;
      }
      return flattenMenuGroup(zero);
    }

   const results: ApiMenuItem[] = [];
   for (const key of Object.keys(obj)) {
     const v = obj[key];
     if (!v) continue;
     if (isApiMenuItem(v)) {
       results.push(v);
     } else if (Array.isArray(v)) {
       results.push(...v.filter(isApiMenuItem));
     } else if (typeof v === 'object') {
       const nested = flattenMenuGroup(v);
       results.push(...nested);
     }
   }
   return results;
 }

 function getChildrenByParentId(groups: ApiMenuGroups | undefined, parentId: number): ApiMenuItem[] {
   if (!groups) return [];
   const results: ApiMenuItem[] = [];
   for (const [, value] of Object.entries(groups)) {
     const items = flattenMenuGroup(value);
     for (const item of items) {
       if (item.parent_menu_id === parentId) {
         results.push(item);
       }
     }
   }
   return results;
 }

 function getGroupedMenuItems(groups: ApiMenuGroups | undefined, parentId: number): ApiMenuItem[] {
   return getChildrenByParentId(groups, parentId);
 }

export function buildMenuTree(
  level1: ApiMenuItem[],
  level2: ApiMenuGroups | undefined,
  level3: ApiMenuGroups | undefined,
): MenuItem[] {
  return level1
    .filter(item => item.status === 1)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    .map(item => {
      const l2Array = getGroupedMenuItems(level2, item.id);
      const submenus: SubmenuItem[] = l2Array
        .filter(sub => sub.status === 1)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .map(sub => {
          const l3Array = getGroupedMenuItems(level3, sub.id);
          const level3Items: Level3Item[] = l3Array
            .filter(l3 => l3.status === 1)
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
            .map(l3 => ({
              id: l3.id,
              parentId: l3.parent_menu_id,
              menuType: l3.menu_type,
              label: l3.name || l3.menu_title || l3.site_map_name,
              href: resolveRoute(l3.link),
            }));
          return {
            id: sub.id,
            parentId: sub.parent_menu_id,
            menuType: sub.menu_type,
            label: sub.name || sub.menu_title || sub.site_map_name,
            href: resolveRoute(sub.link),
            icon: resolveIcon(sub.icon, 2),
            submenus: level3Items.length > 0 ? level3Items : undefined,
          };
        });
      return {
        id: item.id,
        menuType: item.menu_type,
        icon: resolveIcon(item.icon, 1),
        label: item.name || item.menu_title || item.site_map_name,
        href: resolveRoute(item.link),
        submenus: submenus.length > 0 ? submenus : undefined,
      };
    });
}

export function mapApiIconToComponent(iconString: string | null, level: number = 1): MenuIcon {
  return resolveIcon(iconString, level);
}
