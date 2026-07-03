import { BookOpen, Calendar, FileText, BarChart3, MessageCircle, Settings, Search, Users } from 'lucide-react';
import type { ComponentType } from 'react';

export type MenuIcon = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;

export interface Level3Item {
  id?: number | string;
  parentId?: number | string;
  menuType?: string | null;
  label: string;
  href: string;
}

export interface SubmenuItem {
  id?: number | string;
  parentId?: number | string;
  menuType?: string | null;
  label: string;
  href: string;
  icon?: MenuIcon;
  submenus?: Level3Item[];
}

export interface MenuItem {
  id?: number | string;
  menuType?: string | null;
  icon: MenuIcon;
  label: string;
  href?: string;
  submenus?: SubmenuItem[];
}

export const menuItems: MenuItem[] = [

  { 
    icon: Search, 
    label: 'Search / Edit Student', 
    href: '/search_student',
    submenus: [
      { label: 'Student Profiles', href: '/search_student', icon: Users },
      { label: 'Documents', href: '/search_student', icon: FileText },
    ]
  },
  { 
    icon: BookOpen, 
    label: 'Subjects', 
    href: '/subjects',
    submenus: [
      { label: 'All Subjects', href: '/subjects', icon: BookOpen },
      { label: 'Add Subject', href: '/subjects/add', icon: FileText },
      { label: 'Subject Categories', href: '/subjects/categories', icon: Calendar,
        submenus: [
          { label: 'Arts', href: '/subjects/categories/arts' },
          { label: 'Science', href: '/subjects/categories/science' },
          { label: 'Mathematics', href: '/subjects/categories/mathematics' },
          { label: 'English', href: '/subjects/categories/english' },
          { label: 'History', href: '/subjects/categories/history' },
          { label: 'Geography', href: '/subjects/categories/geography' },
        ]
      },
    ]
  },
  { 
    icon: Calendar, 
    label: 'Planning', 
    href: '/planning',
    submenus: [
      { label: 'Calendar', href: '/planning/calendar', icon: Calendar },
      { label: 'Schedule', href: '/planning/schedule', icon: FileText },
      { label: 'Timetable', href: '/planning/timetable', icon: BarChart3 },
    ]
  },
  { 
    icon: FileText, 
    label: 'Quiz', 
    href: '/quiz',
    submenus: [
      { label: 'All Quizzes', href: '/quiz', icon: FileText },
      { label: 'Create Quiz', href: '/quiz/create', icon: FileText },
      { label: 'Quiz Bank', href: '/quiz/bank', icon: BarChart3 },
    ]
  },
  { 
    icon: BarChart3, 
    label: 'Analytics', 
    href: '/analytics',
    submenus: [
      { label: 'Overview', href: '/analytics', icon: BarChart3 },
      { label: 'Reports', href: '/analytics/reports', icon: FileText },
      { label: 'Performance', href: '/analytics/performance', icon: Calendar },
    ]
  },
  { 
    icon: MessageCircle, 
    label: 'Messages', 
    href: '/messages',
    submenus: [
      { label: 'Inbox', href: '/messages', icon: MessageCircle },
      { label: 'Sent', href: '/messages/sent', icon: FileText },
      { label: 'Compose', href: '/messages/compose', icon: Calendar },
    ]
  },
  { 
    icon: Settings, 
    label: 'Settings', 
    href: '/settings',
    submenus: [
      { label: 'Profile', href: '/settings/profile', icon: Settings },
      { label: 'Account', href: '/settings/account', icon: Settings },
      { label: 'Preferences', href: '/settings/preferences', icon: Settings },
    ]
  },
];

export function getCurrentLevel3Menu(pathname: string, items: MenuItem[] = menuItems): { parentLabel: string; items: Level3Item[] } | null {
   for (const item of items) {
     if (item.submenus && item.href) {
       for (const submenu of item.submenus) {
         if (submenu.submenus && submenu.submenus.length > 0 && pathname.startsWith(submenu.href)) {
           return { parentLabel: submenu.label, items: submenu.submenus };
         }
       }
     }
   }
   return null;
 }
