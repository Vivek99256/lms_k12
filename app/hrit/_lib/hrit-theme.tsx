import type { CSSProperties, ReactNode } from 'react'
import { BLUE_THEME } from '@/app/organization-management/_lib/blue-theme'

/**
 * The app-wide `--primary` is grayscale and chart tokens are unset, so scope HRIT's blue and chart
 * palette to this module without touching other pages.
 * `display: contents` keeps the wrapper out of the layout.
 */
export function HritTheme({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        ...BLUE_THEME,
        '--chart-blue': 'hsl(221 83% 53%)',
        '--chart-red': 'hsl(0 84% 60%)',
        '--chart-yellow': 'hsl(38 92% 50%)',
        '--chart-green': 'hsl(142 71% 45%)',
        '--chart-teal': 'hsl(173 80% 40%)',
        '--chart-indigo': 'hsl(239 84% 67%)',
      } as CSSProperties}
      className="contents"
    >
      {children}
    </div>
  )
}
