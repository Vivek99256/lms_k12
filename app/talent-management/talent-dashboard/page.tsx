'use client'

import { TalentDashboard } from './components/TalentDashboardView'
import { TalentTheme } from '../_lib/talent-theme'

function TalentDashboardPageInner() {
  return <TalentDashboard />
}

export default function TalentDashboardPage() {
  return (
    <TalentTheme>
      <TalentDashboardPageInner />
    </TalentTheme>
  )
}
