'use client';

import { AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import SectionCard from './SectionCard';
import type { AiOverlayHealth } from '../data/knowledge-graph';

/**
 * Switch + persistent caveat for the Neo4j "AI-suggested" overlay.
 *
 * The caveat is never dismissible and never conditional on the health
 * numbers looking bad — CoherenceMapRepository's own data is almost
 * entirely unreviewed AI drafts (tagged_by: ai, status: draft) even when
 * the graph is otherwise well-formed, so "the overlay is on" is itself
 * always reason enough to show it.
 */
export default function AiOverlayToggle({
  enabled,
  onToggle,
  loading,
  health,
}: {
  enabled: boolean;
  onToggle: (next: boolean) => void;
  loading?: boolean;
  health?: AiOverlayHealth | null;
}) {
  return (
    <SectionCard title="AI overlay" icon={Sparkles} accent="warning">
      <label className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-700">Show AI-suggested links</span>
        <span className="flex items-center gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-amber-600" /> : null}
          <Switch checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
        </span>
      </label>

      {enabled ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            These links are unreviewed AI suggestions, not curator-confirmed prerequisites.
            {health && !health.acyclic ? ` This scope also contains ${health.cycles.length} prerequisite cycle${health.cycles.length === 1 ? '' : 's'}.` : ''}
            {health && health.isolated > 0 ? ` ${health.isolated} concept${health.isolated === 1 ? '' : 's'} have no link at all.` : ''}
            {' '}Treat dashed amber edges as hypotheses, not fact.
          </p>
        </div>
      ) : null}
    </SectionCard>
  );
}
