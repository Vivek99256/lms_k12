import type { CSSProperties, ReactNode } from 'react'

/**
 * The app-wide `--primary` is grayscale, so inside the module shell the Task Management screens
 * render black and white: black buttons, black progress bars. Scoping the blue to the screen's own
 * wrapper (the same values as g2g/globals.css) gives them a proper primary colour without touching
 * any other page. `display: contents` keeps the wrapper out of the layout.
 */
export const BLUE_THEME = {
  '--primary': 'hsl(221 83% 53%)',
  '--primary-foreground': 'hsl(0 0% 100%)',
  '--ring': 'hsl(221 83% 53%)',
} as CSSProperties

export function TaskTheme({ children }: { children: ReactNode }) {
  return (
    <div style={BLUE_THEME} className="contents">
      {children}
    </div>
  )
}
