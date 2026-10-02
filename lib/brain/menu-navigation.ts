import type { MenuItem } from '@/app/data/menuItems';
import { BRAIN_MENU_LABEL, BRAIN_ROOT, BRAIN_SECTIONS } from './navigation';

const normalizeLabel = (label: string) => label.toLowerCase().replace(/\s+/g, '');

export function isBrainMenu(item: MenuItem): boolean {
  return item.id === 'enterprise-brain' || normalizeLabel(item.label) === normalizeLabel(BRAIN_MENU_LABEL);
}

/** Resolve placeholder links without adding any rows to the rights-filtered tree. */
export function resolveBrainMenuLinks(item: MenuItem): MenuItem {
  if (!isBrainMenu(item)) return item;

  return {
    ...item,
    href: item.href === '#' ? BRAIN_ROOT : item.href,
    submenus: item.submenus?.map((submenu) => {
      const section = BRAIN_SECTIONS.find((entry) => normalizeLabel(entry.label) === normalizeLabel(submenu.label));
      if (!section) return submenu;

      return {
        ...submenu,
        href: submenu.href === '#' ? section.href : submenu.href,
        submenus: submenu.submenus?.map((screen) => {
          if (screen.href !== '#') return screen;
          const target = section.screens.find((entry) => normalizeLabel(entry.label) === normalizeLabel(screen.label));
          return target ? { ...screen, href: target.href, link: target.href } : screen;
        }),
      };
    }),
  };
}
