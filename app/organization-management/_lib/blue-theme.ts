import type { CSSProperties } from 'react'

/**
 * The app-wide `--primary` is grayscale, so inside the module shell these screens render black
 * and white. Scoping the G2G blue to the screen's own wrapper (the same values as
 * g2g/globals.css) gives them the Role and Permissions look without touching other pages.
 */
export const BLUE_THEME = {
  '--primary': 'hsl(221 83% 53%)',
  '--primary-foreground': 'hsl(0 0% 100%)',
  '--ring': 'hsl(221 83% 53%)',
} as CSSProperties
