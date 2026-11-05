import type { ReactNode } from 'react'
import { BLUE_THEME } from '@/app/organization-management/_lib/blue-theme'

/**
 * The app-wide `--primary` is grayscale, so inside the module shell the Talent Management screens
 * render black and white: black buttons, black selected tabs. Scoping the blue to the screen's own
 * wrapper gives them a proper primary colour without touching any other page. `display: contents`
 * keeps the wrapper out of the layout.
 */
export function TalentTheme({ children }: { children: ReactNode }) {
  return (
    <div style={BLUE_THEME} className="contents">
      {children}
    </div>
  )
}
