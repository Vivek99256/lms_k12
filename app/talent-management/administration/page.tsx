'use client'

/**
 * Route for the Talent Management "Administration & Governance" center.
 * Ported from G2G's `components/domain/talent/administration/` — a
 * read-only, list-only feature area in source (only the Workflows tab is
 * live, backed by `GET /talent/admin/workflows`). See `AdminCenter` for the
 * full port notes.
 */

import { AdminCenter } from './components'

export default function AdministrationPage() {
  return <AdminCenter />
}
