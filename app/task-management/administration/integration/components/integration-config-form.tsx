'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { StatusBadge } from '@/components/ui/status-badge'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Field, InlineMessage, NativeSelect } from '@/app/task-management/_components/task-shared'
import type { IntegrationConfig, IntegrationConfigPayload, IntegrationProviderDef } from '@/app/task-management/_lib/integration-types'

function statusVariant(status: string): 'active' | 'inactive' | 'error' | 'processing' {
  if (status === 'active') return 'active'
  if (status === 'error') return 'error'
  return 'inactive'
}

export function IntegrationConfigForm({
  provider,
  config,
  onSave,
  onTest,
  onRemove,
  onDirtyChanged,
  saving,
  testing,
  canAdminister,
}: {
  provider: IntegrationProviderDef
  config?: IntegrationConfig
  onSave: (payload: IntegrationConfigPayload) => Promise<void>
  onTest: (providerKey: string, values: Record<string, unknown>) => Promise<{ success: boolean; message: string }>
  onRemove?: (id: number) => Promise<void>
  onDirtyChanged?: (dirty: boolean) => void
  saving: boolean
  testing: boolean
  canAdminister: boolean
}) {
  const buildDefaults = (): Record<string, string | number | boolean | null> => {
    if (config) return { ...config.config }
    const defaults: Record<string, string | number | boolean | null> = {}
    provider.fields.forEach((field) => {
      if (field.type === 'toggle') {
        defaults[field.key] = false
      } else if (field.type === 'number') {
        defaults[field.key] = field.key === 'port' ? 587 : 0
      } else {
        defaults[field.key] = field.options?.[0]?.value ?? ''
      }
    })
    return defaults
  }

  const [values, setValues] = useState<Record<string, string | number | boolean | null>>(buildDefaults)
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>(() => {
    if (config?.status === 'error') return 'inactive'
    return config?.status ?? 'inactive'
  })
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  const isEditing = Boolean(config?.id)

  const handleChange = (key: string, value: string | number | boolean | null) => {
    setValues((prev) => {
      const next = { ...prev, [key]: value }
      setHasChanges(true)
      setTestResult(null)
      onDirtyChanged?.(true)
      return next
    })
  }

  const handleSave = async () => {
    await onSave({
      provider_key: provider.key,
      display_name: provider.name,
      category: provider.category,
      description: provider.description,
      status: formStatus,
      config: values,
    })
    setHasChanges(false)
    onDirtyChanged?.(false)
  }

  const handleTest = async () => {
    const result = await onTest(provider.key, values)
    setTestResult(result)
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-950">
              {isEditing ? 'Edit Configuration' : 'New Configuration'}
            </h2>
            <p className="text-xs text-slate-600">{provider.description}</p>
          </div>
          <div className="flex items-center gap-2">
            {isEditing && config && (
              <StatusBadge variant={statusVariant(config.status)} status={config.status} />
            )}
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
              <Switch
                checked={formStatus === 'active'}
                onChange={(e) => {
                  setFormStatus(e.target.checked ? 'active' : 'inactive')
                  setHasChanges(true)
                }}
                disabled={!canAdminister}
              />
              {formStatus === 'active' ? 'Active' : 'Inactive'}
            </label>
          </div>
        </div>
      </div>

      <div className="p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void handleSave()
          }}
        >
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {provider.fields.map((field) => (
              <Field key={field.key} label={field.label}>
                {renderField(field, values[field.key], (value) => handleChange(field.key, value))}
              </Field>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={testing || saving || !canAdminister}
            >
              {testing ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner className="size-3.5" />
                  Testing...
                </span>
              ) : (
                'Test Connection'
              )}
            </Button>
            <Button type="submit" disabled={saving || !canAdminister}>
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner className="size-3.5" />
                  Saving...
                </span>
              ) : isEditing ? (
                'Update Configuration'
              ) : (
                'Save Configuration'
              )}
            </Button>
            {isEditing && onRemove && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  if (window.confirm(`Remove ${provider.name} configuration?`)) {
                    void onRemove(config!.id)
                  }
                }}
                disabled={saving || !canAdminister}
              >
                Remove
              </Button>
            )}
            {hasChanges && (
              <span className="text-xs text-warning">You have unsaved changes.</span>
            )}
          </div>

          {testResult && (
            <div className="mt-4">
              <InlineMessage type={testResult.success ? 'success' : 'error'} text={testResult.message} />
            </div>
          )}

          {isEditing && config && (
            <div className="mt-4 text-xs text-muted-foreground">
              <p>
                Last updated: {config.last_updated_at ? new Date(config.last_updated_at).toLocaleString() : 'Never'}
                {config.last_updated_by ? ` by ${config.last_updated_by}` : ''}
              </p>
              <p>
                Last tested: {config.last_tested_at ? new Date(config.last_tested_at).toLocaleString() : 'Never'}
                {config.last_tested_by ? ` by ${config.last_tested_by}` : ''}
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

function renderField(
  field: IntegrationProviderDef['fields'][number],
  value: string | number | boolean | null | undefined,
  onChange: (value: string | number | boolean | null) => void,
) {
  if (field.type === 'select') {
    return (
      <NativeSelect
        value={String(value ?? '')}
        onChange={(next) => onChange(next)}
      >
        {field.options?.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </NativeSelect>
    )
  }

  if (field.type === 'textarea') {
    return (
      <Textarea
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className="min-h-24"
      />
    )
  }

  if (field.type === 'toggle') {
    return (
      <Switch checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
    )
  }

  if (field.type === 'number') {
    return (
      <Input
        type="number"
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        placeholder={field.placeholder}
      />
    )
  }

  return (
    <Input
      type="text"
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
    />
  )
}
