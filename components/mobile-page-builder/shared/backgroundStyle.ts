import type { CSSProperties } from 'react';
import type { MobileBackground } from './layoutTypes';

/**
 * Computes the CSS for a page's background from its JSON config. Shared by
 * the editor canvas (MobileScreenRoot) and the production renderer
 * (MobilePageRenderer) so a design looks identical in both -- see the
 * builder's "share the same rendering logic" requirement.
 */
export function backgroundStyle(background: MobileBackground | undefined | null): CSSProperties {
  if (!background) {
    return { backgroundColor: '#FFFFFF' };
  }

  const opacity = typeof background.opacity === 'number' ? background.opacity : 1;

  if (background.type === 'gradient') {
    const from = background.gradientFrom || '#FFFFFF';
    const to = background.gradientTo || '#F1F5F9';
    const direction = background.gradientDirection || 'to bottom';
    return {
      backgroundImage: `linear-gradient(${direction}, ${from}, ${to})`,
      opacity,
    };
  }

  if (background.type === 'image' && background.url) {
    const position = background.position || 'center';
    const safeUrl = background.url.replace(/"/g, '%22');
    return {
      backgroundColor: background.color || '#FFFFFF',
      backgroundImage: `url("${safeUrl}")`,
      backgroundSize: background.size || 'cover',
      backgroundPosition: position,
      backgroundRepeat: 'no-repeat',
      opacity,
    };
  }

  return {
    backgroundColor: background.color || '#FFFFFF',
    opacity,
  };
}
