/**
 * Ported as-is from G2G's `components/shell/icon-glyph.tsx`. Renders an MDI
 * icon class (e.g. "mdi mdi-domain") coming straight from
 * tblmenumaster_g2g.icon / the LMS-K12 menu-master equivalent. Used by
 * `RolePermissionsMatrix` (organization-management/role-and-permissions) to
 * render each module's icon.
 */
import { cn } from '@/lib/utils'

export function IconGlyph({ icon, className }: { icon?: string | null; className?: string }) {
  if (!icon) return null
  return <i className={cn(icon, className)} aria-hidden="true" />
}
