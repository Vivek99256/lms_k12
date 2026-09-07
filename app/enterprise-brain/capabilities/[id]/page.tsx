'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { brainFetch, tenantPath, type BrainRow } from '@/lib/brain/api';
import { useBrainResource } from '../../_components/useBrainResource';
import { Card, DataTable, ErrorState, LoadingState, Panel, Pill, ScreenHeader } from '../../_components/primitives';

interface CapabilityDetail {
  data: BrainRow & {
    knowledge?: string[];
    ability?: string[];
    skill?: string[];
    behaviour?: string[];
    attitude?: string[];
  };
  assignments: BrainRow[];
  proficiency: BrainRow[];
  tasks: BrainRow[];
  versions: BrainRow[];
  audit: BrainRow[];
  assignableTargets: { department: Array<{ id: string; label: string }>; person: Array<{ id: string; label: string }> };
}

const FACETS = ['knowledge', 'ability', 'skill', 'behaviour', 'attitude'] as const;

export default function CapabilityDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = String(params?.id ?? '');

  const [targetType, setTargetType] = useState<'department' | 'person'>('person');
  const [targetId, setTargetId] = useState('');
  const [assignError, setAssignError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: '', category: '', status: '', criticality: '', description: '' });

  const resource = useBrainResource(() => brainFetch<CapabilityDetail>(tenantPath(`/capabilities/${id}`)), [id]);

  const assign = async () => {
    if (!targetId) {
      setAssignError('Choose who this capability is assigned to.');
      return;
    }
    setBusy(true);
    setAssignError('');
    try {
      await brainFetch(tenantPath(`/capabilities/${id}/assign`), {
        method: 'POST',
        body: JSON.stringify({ target_type: targetType, target_id: targetId }),
      });
      setTargetId('');
      resource.refresh();
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Could not assign the capability.');
    } finally {
      setBusy(false);
    }
  };

  const unassign = async (assignmentId: string) => {
    setBusy(true);
    setAssignError('');
    try {
      await brainFetch(tenantPath(`/capabilities/${id}/assign/${assignmentId}`), { method: 'DELETE' });
      resource.refresh();
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Could not remove the assignment.');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      await brainFetch(tenantPath(`/capabilities/${id}`), { method: 'PATCH', body: JSON.stringify(draft) });
      setEditing(false);
      resource.refresh();
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Could not save the capability.');
    } finally {
      setBusy(false);
    }
  };

  if (resource.loading && !resource.data) return <LoadingState label="Loading capability" />;
  if (resource.error && !resource.data) return <ErrorState message={resource.error} onRetry={resource.refresh} />;

  const detail = resource.data;
  if (!detail) return null;
  const capability = detail.data;

  return (
    <div className="pb-8">
      <button
        type="button"
        onClick={() => router.push('/enterprise-brain/capabilities')}
        className="mb-3 flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft size={14} /> All capabilities
      </button>

      <ScreenHeader
        title={String(capability.name ?? 'Capability')}
        description={String(capability.description ?? '') || undefined}
        breadcrumb="Enterprise Brain / Foundation / Capabilities"
        onRefresh={resource.refresh}
        refreshing={resource.refreshing}
        actions={
          <button
            type="button"
            onClick={() => {
              setDraft({
                name: String(capability.name ?? ''),
                category: String(capability.category ?? ''),
                status: String(capability.status ?? ''),
                criticality: String(capability.criticality ?? ''),
                description: String(capability.description ?? ''),
              });
              setEditing((open) => !open);
            }}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 hover:text-gray-900"
          >
            {editing ? 'Cancel' : 'Edit'}
          </button>
        }
      />

      <Card className="mb-6 flex flex-wrap gap-6 p-5">
        {([
          ['Code', capability.capability_code],
          ['Category', capability.category],
          ['Type', capability.capability_type],
          ['Criticality', capability.criticality],
          ['Difficulty', capability.difficulty],
          ['Status', capability.status],
          ['Version', capability.version],
        ] as const).map(([label, value]) => (
          <div key={label}>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
            <p className="text-sm font-semibold text-slate-900">{value == null || value === '' ? '—' : String(value)}</p>
          </div>
        ))}
      </Card>

      {editing && (
        <Card className="mb-6 p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {([
              ['name', 'Name'],
              ['category', 'Category'],
              ['criticality', 'Criticality'],
              ['status', 'Status'],
            ] as const).map(([field, label]) => (
              <label key={field} className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-gray-400">{label}</span>
                <input
                  value={draft[field]}
                  onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#0D6EFD]"
                />
              </label>
            ))}
            <label className="block md:col-span-2">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-gray-400">Description</span>
              <textarea
                value={draft.description}
                onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                rows={3}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#0D6EFD]"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="mt-4 rounded-xl bg-[#0D6EFD] px-4 py-2 text-xs font-bold text-white hover:bg-blue-600 disabled:opacity-60"
          >
            Save changes
          </button>
        </Card>
      )}

      <h2 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">KASBA</h2>
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {FACETS.map((facet) => {
          const items = (capability[facet] as string[] | undefined) ?? [];
          return (
            <Panel key={facet} title={facet.charAt(0).toUpperCase() + facet.slice(1)} count={items.length}>
              {items.length ? (
                <ul className="max-h-56 space-y-1 overflow-auto px-4 py-3 text-sm text-slate-600 scrollbar-hide">
                  {items.map((item, index) => (
                    <li key={`${facet}-${index}`} className="rounded-lg bg-gray-50 px-2.5 py-1.5">
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-6 text-sm text-slate-400">Nothing recorded for this facet.</p>
              )}
            </Panel>
          );
        })}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Assignments" table="hpbrain_capability_assignments" count={detail.assignments.length}>
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-3">
            <select
              value={targetType}
              onChange={(event) => {
                setTargetType(event.target.value as 'department' | 'person');
                setTargetId('');
              }}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none"
            >
              <option value="person">Person</option>
              <option value="department">Department</option>
            </select>
            <select
              value={targetId}
              onChange={(event) => setTargetId(event.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none"
            >
              <option value="">Select {targetType}…</option>
              {detail.assignableTargets[targetType].map((target) => (
                <option key={target.id} value={target.id}>
                  {target.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={assign}
              disabled={busy}
              className="rounded-xl bg-[#0D6EFD] px-3 py-2 text-xs font-bold text-white hover:bg-blue-600 disabled:opacity-60"
            >
              Assign
            </button>
          </div>
          {assignError && <p className="px-4 pt-3 text-sm text-red-600">{assignError}</p>}
          {detail.assignments.length ? (
            <ul className="divide-y divide-gray-100">
              {detail.assignments.map((assignment) => (
                <li key={String(assignment.id)} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <Pill tone="blue">{String(assignment.target_type ?? '')}</Pill>
                  <span className="min-w-0 flex-1 truncate text-slate-700">{String(assignment.target_label ?? assignment.target_id ?? '')}</span>
                  <span className="text-[11px] text-slate-400">{String(assignment.assigned_date ?? '')}</span>
                  <button
                    type="button"
                    onClick={() => unassign(String(assignment.id))}
                    disabled={busy}
                    title="Remove assignment"
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-sm text-slate-400">Not assigned to anyone yet.</p>
          )}
        </Panel>

        <Panel title="Tasks" table="hpbrain_capability_tasks" count={detail.tasks.length}>
          <DataTable
            columns={[
              { key: 'name', label: 'Task' },
              { key: 'evidence_required', label: 'Evidence' },
              { key: 'status', label: 'Status' },
            ]}
            rows={detail.tasks}
            emptyMessage="No tasks recorded for this capability."
          />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Proficiency assessments" table="hpbrain_capability_proficiency" count={detail.proficiency.length}>
          <DataTable
            columns={[
              { key: 'knowledge_level', label: 'K' },
              { key: 'ability_level', label: 'A' },
              { key: 'skill_level', label: 'S' },
              { key: 'behaviour_level', label: 'B' },
              { key: 'attitude_level', label: 'At' },
              { key: 'evidence_confidence', label: 'Confidence' },
              { key: 'assessed_date', label: 'Assessed' },
            ]}
            rows={detail.proficiency}
            emptyMessage="No assessments recorded against this capability's assignments."
          />
        </Panel>

        <Panel title="Audit" table="hpbrain_audit_logs" count={detail.audit.length}>
          <DataTable
            columns={[
              { key: 'action', label: 'Action' },
              { key: 'actor_id', label: 'Actor' },
              { key: 'created_at', label: 'When' },
            ]}
            rows={detail.audit}
            emptyMessage="Nothing has changed this capability inside the Brain."
          />
        </Panel>
      </div>
    </div>
  );
}
