'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

/**
 * Used on every /integration/* detail route whose reused screen already
 * ships its own page header — adds the required "back to Integration"
 * affordance without stacking a second, redundant header above it.
 */
export function IntegrationBackLink() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 pt-4">
      <Link
        href="/integration"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Integration
      </Link>
    </div>
  )
}
