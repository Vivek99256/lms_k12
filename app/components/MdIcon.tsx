import type { ComponentType } from 'react';
import React from 'react';

type MenuIconProps = { size?: number; strokeWidth?: number; className?: string };

const mdiIconCache = new Map<string, ComponentType<MenuIconProps>>();

export function createMdIcon(iconString: string | null): ComponentType<MenuIconProps> | null {
  if (!iconString) return null;
  
  const cacheKey = iconString.toLowerCase().trim();
  const cached = mdiIconCache.get(cacheKey);
  if (cached) return cached;
  
  let mdiClass = iconString
    .toLowerCase()
    .replace(/fa-fw/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // If icon doesn't already start with 'mdi mdi-', prepend 'mdi mdi-'
  if (!mdiClass.startsWith('mdi')) {
    mdiClass = `mdi-${mdiClass}`;
  }
  
  const MdIcon: ComponentType<MenuIconProps> = ({ size, className }: MenuIconProps) => 
    React.createElement('i', {
      className: `mdi ${mdiClass} ${className || ''}`,
      style: { fontSize: size }
    });
  
  mdiIconCache.set(cacheKey, MdIcon);
  return MdIcon;
}