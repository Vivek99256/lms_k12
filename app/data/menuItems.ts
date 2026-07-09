import { LayoutDashboard } from 'lucide-react';
import type { ComponentType } from 'react';

export type MenuIcon = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;

export interface Level3Item {
  id?: number | string;
  parentId?: number | string;
  menuType?: string | null;
  label: string;
  href: string;
  link?: string | null;
}

export interface SubmenuItem {
  id?: number | string;
  tblmenu_master_id?: number;
  parentId?: number | string;
  menuType?: string | null;
  label: string;
  href: string;
  link?: string | null;
  route_name?: string;
  icon?: MenuIcon;
  submenus?: Level3Item[];
}

export interface MenuItem {
  id?: number | string;
  menuType?: string | null;
  icon: MenuIcon;
  label: string;
  href?: string;
  link?: string | null;
  submenus?: SubmenuItem[];
}

// Empty array - all menu data comes from API dynamically
export const menuItems: MenuItem[] = [];

// Default icon for menu items without icons (comes from API)
export const DefaultMenuIcon = LayoutDashboard;
