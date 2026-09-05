'use client';

import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { brainFetch, tenantPath, type BrainRow } from '@/lib/brain/api';
import { useBrainResource } from '../_components/useBrainResource';
import { Card, DataTable, ErrorState, LoadingState, Panel, Pill, ScreenHeader } from '../_components/primitives';

interface SettingsPayload {
  tenantId: string;
  available: boolean;
  role: string;
  organization: { name: string; orgCode: string; projected: boolean };
  settings: Array<{ tenant_id: string; user_id: string; key: string; value: string; updated_date: string }>;
  apiKeys: BrainRow[];
  audit: BrainRow[];
  permissions: string[];
}

export default function BrainSettingsPage() {
  const resource = useBrainResource(() => brainFetch<SettingsPayload>(tenantPath('/settings')), []);
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const save = async () => {
    if (!key.trim()) {
      setSaveError('A setting needs a key.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      await brainFetch(tenantPath('/settings'), { method: 'PUT', body: JSON.stringify({ key: key.trim(), value }) });
      setKey('');
      setValue('');
      resource.refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save the setting.');
    } finally {
      setSaving(false);
    }
  };

  if (resource.loading && !resource.data) return <LoadingState label="Loading settings" />;
  if (resource.error && !resource.data) return <ErrorState message={resource.error} onRetry={resource.refresh} />;

  const data = resource.data;
  if (!data) return null;

  const canManage = data.permissions.includes('settings.manage');

  return (
    <div className="pb-8">
      <ScreenHeader
        title="Account / Settings"
        description="Configuration, permissions, API keys and audit for this organization."
        breadcrumb="Enterprise Brain / Account"
        onRefresh={resource.refresh}
        refreshing={resource.refreshing}
      />

      <Card className="mb-6 flex flex-wrap items-center gap-6 p-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Organization</p>
          <p className="text-sm font-semibold text-slate-900">{data.organization.name}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Tenant</p>
          <p className="font-mono text-sm text-slate-700">{data.tenantId}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Your Brain role</p>
          <p className="text-sm font-semibold text-slate-900">{data.role || 'viewer'}</p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-gray-400">Permissions</p>
          <div className="flex flex-wrap gap-1.5">
            {data.permissions.length ? (
              data.permissions.map((permission) => (
                <Pill key={permission} tone="blue">
                  {permission}
                </Pill>
              ))
            ) : (
              <span className="text-sm text-slate-400">No Brain permissions granted.</span>
            )}
          </div>
        </div>
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Organization settings" table="hpbrain_settings" count={data.settings.length} available={data.available}>
          {canManage ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-3">
              <input
                value={key}
                onChange={(event) => setKey(event.target.value)}
                placeholder="setting.key"
                className="w-44 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#0D6EFD]"
              />
              <input
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="value"
                className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#0D6EFD]"
              />
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded-xl bg-[#0D6EFD] px-3 py-2 text-xs font-bold text-white hover:bg-blue-600 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 text-sm text-slate-500">
              <ShieldCheck size={15} /> Your role can read these settings but not change them.
            </div>
          )}
          {saveError && <p className="px-4 pt-3 text-sm text-red-600">{saveError}</p>}
          <DataTable
            columns={[
              { key: 'key', label: 'Key' },
              { key: 'value', label: 'Value' },
              { key: 'user_id', label: 'Scope' },
              { key: 'updated_date', label: 'Updated' },
            ]}
            rows={data.settings}
            emptyMessage="No settings stored for this organization yet."
          />
        </Panel>

        <Panel title="API keys" table="hpbrain_api_keys" count={data.apiKeys.length}>
          <DataTable
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'key_prefix', label: 'Prefix' },
              { key: 'scopes', label: 'Scopes' },
              { key: 'last_used_date', label: 'Last used' },
              { key: 'revoked_date', label: 'Revoked' },
            ]}
            rows={data.apiKeys}
            emptyMessage="No Brain API keys issued for this organization."
          />
        </Panel>
      </div>

      <Panel title="Audit log" table="hpbrain_audit_logs" count={data.audit.length}>
        <DataTable
          maxHeight="30rem"
          columns={[
            { key: 'created_at', label: 'When' },
            { key: 'action', label: 'Action' },
            { key: 'entity_type', label: 'Entity' },
            { key: 'entity_id', label: 'Id' },
            { key: 'actor_id', label: 'Actor' },
            { key: 'status', label: 'Status' },
          ]}
          rows={data.audit}
          emptyMessage="Nothing has been done in the Brain for this organization yet."
        />
      </Panel>
    </div>
  );
}
