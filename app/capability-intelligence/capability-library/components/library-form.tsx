'use client'

import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/g2g/button'
import { Input } from '@/components/ui/g2g/input'
import { Select } from '@/components/ui/g2g/select'
import { Textarea } from '@/components/ui/g2g/textarea'
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { LibraryMeta, LibraryPayload, LibraryRow } from '../../_lib/libraries-taxonomy-api'

import { FORM_KEY_OVERRIDES, type LibraryFieldDef, type LibraryTabConfig } from './library-config'
import { buildSessionContext, competencyLibraryService, roleRequirementsService } from '../../_lib/competency-extras-api'
import { RoleCompetencyInlinePanel } from './role-competency-inline-panel'
import { SearchableSelect } from '@/components/ui/g2g/searchable-select'

interface LibraryFormProps {
  config: LibraryTabConfig
  /** null when creating. */
  initial: LibraryRow | null
  saving: boolean
  categories: string[]
  subCategoriesOf: (category: string) => string[]
  /** The tenant's live vocabularies, so departments and roles are picked not typed. */
  meta: LibraryMeta
  onSubmit: (payload: LibraryPayload) => Promise<{ ok: boolean; message: string; createdId?: number | null }>
  onCancel: () => void
  onSaved: () => void
}

/** Sentinel option that switches the picker into "type a new one" mode. */
const ADD_NEW = '__add_new__'

/** "29 departments in this organisation." — plural handling included. */
function countLabel(count: number, label: string): string {
  const noun = label.toLowerCase()
  if (count === 0) return `No ${noun} recorded for this organisation yet.`
  if (count === 1) return `1 ${noun} in this organisation.`
  return `${count} ${noun}s in this organisation.`
}

/**
 * A dropdown of what already exists, plus an explicit way to add something new.
 */
function OpenChoice({
  id,
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  id: string
  label: string
  value: string
  options: string[]
  placeholder?: string
  onChange: (value: string) => void
}) {
  const [typing, setTyping] = useState(() => Boolean(value) && !options.includes(value))

  if (typing) {
    return (
      <div className="space-y-1.5">
        <Input
          id={id}
          value={value}
          autoFocus
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder ?? `New ${label.toLowerCase()}`}
          className="bg-background border-border"
        />
        <button
          type="button"
          onClick={() => { setTyping(false); onChange('') }}
          className="text-xs font-medium text-primary hover:underline"
        >
          ← Choose from the existing {label.toLowerCase()} list
        </button>
      </div>
    )
  }

  return (
    <Select
      id={id}
      value={value}
      onChange={(next) => {
        if (next === ADD_NEW) { setTyping(true); onChange('') }
        else onChange(next)
      }}
      options={[
        { label: options.length ? `Select ${label.toLowerCase()}` : `No ${label.toLowerCase()} yet — add the first one`, value: '' },
        ...options.map((option) => ({ label: option, value: option })),
        { label: `+ Add a new ${label.toLowerCase()}…`, value: ADD_NEW },
      ]}
      className="bg-background border-border h-9"
      aria-label={label}
    />
  )
}

/** Every distinct value a `source` field should offer, from real tenant data. */
function sourceValues(meta: LibraryMeta, source: NonNullable<LibraryFieldDef['source']>): string[] {
  if (source === 'departments') {
    const set = new Set(meta.departments.filter(Boolean))
    Object.keys(meta.jobroles_by_department).forEach((name) => set.add(name))
    return Array.from(set).sort()
  }
  if (source === 'jobroles') {
    const set = new Set(
      Object.values(meta.jobroles_by_department).flat().map((role) => role.jobrole).filter(Boolean),
    )
    return Array.from(set).sort()
  }
  return [...(meta[source] ?? [])].filter(Boolean).sort()
}

function initialValues(config: LibraryTabConfig, initial: LibraryRow | null): Record<string, string> {
  const values: Record<string, string> = {}
  for (const field of config.fields) {
    const raw = initial?.[field.key]
    values[field.key] = raw === null || raw === undefined ? '' : String(raw)
  }
  return values
}

/**
 * Create / edit form for any library tab.
 *
 * The field list comes from the tab config, so all eight tabs share one form
 * and a new column is one config entry rather than a new screen.
 *
 * GAP: "what this role requires" (job role tab only) is backed by
 * `roleRequirementsService` / `competencyLibraryService` — not part of the
 * backend context given for this migration task. See
 * `../../_lib/competency-extras-api.ts`.
 */
export function LibraryForm({
  config,
  initial,
  saving,
  categories,
  subCategoriesOf,
  meta,
  onSubmit,
  onCancel,
  onSaved,
}: LibraryFormProps) {
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(config, initial))
  const [error, setError] = useState<string | null>(null)
  const [pickedComps, setPickedComps] = useState<number[]>([])
  const [roleLibrary, setRoleLibrary] = useState<{ id: number; name: string }[]>([])
  const [roleLibraryError, setRoleLibraryError] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(() => Boolean(initial))

  const editing = Boolean(initial)
  const isJobRole = config.id === 'jobrole'

  useEffect(() => {
    if (!isJobRole || editing) return
    void competencyLibraryService
      .list(buildSessionContext())
      .then((res) => {
        setRoleLibrary((res.data ?? []).map((c) => ({ id: c.id, name: c.name })))
        setRoleLibraryError(null)
      })
      .catch((e: unknown) => {
        setRoleLibrary([])
        setRoleLibraryError(e instanceof Error ? e.message : 'Could not load the competency library.')
      })
  }, [isJobRole, editing])
  const editable = useMemo(() => config.fields.filter((field) => !field.readOnly), [config])
  const essentials = useMemo(() => editable.filter((field) => !field.advanced), [editable])
  const advanced = useMemo(() => editable.filter((field) => field.advanced), [editable])

  const categoryValue = config.categoryKey ? values[config.categoryKey] ?? '' : ''

  /** The job role id behind a chosen role name, when there is exactly one. */
  const resolveJobroleId = (name: string): string | null => {
    const wanted = name.trim().toLowerCase()
    if (!wanted) return null

    const matches = Object.values(meta.jobroles_by_department)
      .flat()
      .filter((role) => String(role.jobrole ?? '').trim().toLowerCase() === wanted)

    return matches.length === 1 ? String(matches[0].id) : null
  }

  const set = (key: string, value: string) => {
    setValues((current) => {
      const next = { ...current, [key]: value }
      if (config.categoryKey && key === config.categoryKey && config.subCategoryKey) {
        next[config.subCategoryKey] = ''
      }
      if (key === 'jobrole') {
        next.jobrole_id = resolveJobroleId(value) ?? ''
      }
      return next
    })
  }

  const optionsFor = (field: LibraryFieldDef): { label: string; value: string }[] => {
    if (field.taxonomy === 'category') {
      const list = categories
      const current = values[field.key]
      const merged = current && !list.includes(current) ? [current, ...list] : list
      return [{ label: `Select ${field.label.toLowerCase()}`, value: '' }, ...merged.map((c) => ({ label: c, value: c }))]
    }

    if (field.taxonomy === 'sub_category') {
      const list = categoryValue ? subCategoriesOf(categoryValue) : []
      const current = values[field.key]
      const merged = current && !list.includes(current) ? [current, ...list] : list
      return [{ label: categoryValue ? 'Select sub category' : 'Pick a category first', value: '' }, ...merged.map((c) => ({ label: c, value: c }))]
    }

    if (field.source) {
      const list = sourceValues(meta, field.source)
      const current = values[field.key]
      const merged = current && !list.includes(current) ? [current, ...list] : list
      return [
        { label: merged.length ? `Select ${field.label.toLowerCase()}` : `No ${field.label.toLowerCase()} available`, value: '' },
        ...merged.map((option) => ({ label: option, value: option })),
      ]
    }

    return [
      { label: `Select ${field.label.toLowerCase()}`, value: '' },
      ...(field.options ?? []).map((option) => ({ label: option, value: option })),
    ]
  }

  function renderField(field: LibraryFieldDef) {
    const isWide = field.type === 'textarea'
    const strictChoice = field.type === 'select' || Boolean(field.taxonomy)
    const openList = Boolean(field.source) && !strictChoice

    return (
      <div key={field.key} className={isWide ? 'md:col-span-2 space-y-2' : 'space-y-2'}>
        <label className="text-sm font-semibold text-foreground" htmlFor={`lib-${field.key}`}>
          {field.label}
          {field.required && <span className="text-destructive"> *</span>}
        </label>

        {field.type === 'textarea' ? (
          <Textarea
            id={`lib-${field.key}`}
            value={values[field.key] ?? ''}
            onChange={(event) => set(field.key, event.target.value)}
            placeholder={field.placeholder}
            className="bg-background border-border min-h-[90px]"
          />
        ) : openList ? (
          <OpenChoice
            id={`lib-${field.key}`}
            label={field.label}
            value={values[field.key] ?? ''}
            options={sourceValues(meta, field.source!)}
            placeholder={field.placeholder}
            onChange={(value) => set(field.key, value)}
          />
        ) : strictChoice ? (
          <Select
            id={`lib-${field.key}`}
            value={values[field.key] ?? ''}
            onChange={(value) => set(field.key, value)}
            options={optionsFor(field)}
            disabled={field.taxonomy === 'sub_category' && !categoryValue}
            className="bg-background border-border h-9"
            aria-label={field.label}
          />
        ) : (
          <Input
            id={`lib-${field.key}`}
            type={field.type === 'url' ? 'url' : 'text'}
            value={values[field.key] ?? ''}
            onChange={(event) => set(field.key, event.target.value)}
            placeholder={field.placeholder}
            className="bg-background border-border"
          />
        )}

        {field.taxonomy === 'category' && categories.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No {field.label.toLowerCase()} defined yet — add one from the Taxonomy panel first.
          </p>
        ) : field.source ? (
          <p className="text-xs text-muted-foreground">
            {countLabel(sourceValues(meta, field.source).length, field.label)}
            {field.help ? ` ${field.help}` : ''}
          </p>
        ) : (
          field.help && <p className="text-xs text-muted-foreground">{field.help}</p>
        )}
      </div>
    )
  }

  const handleSubmit = async () => {
    for (const field of editable) {
      if (field.required && !values[field.key]?.trim()) {
        if (field.advanced) setShowAdvanced(true)
        setError(`${field.label} is required.`)
        return
      }
    }
    setError(null)

    const overrides = FORM_KEY_OVERRIDES[config.id] ?? {}
    const payload: LibraryPayload = {}

    for (const field of editable) {
      const value = (values[field.key] ?? '').trim()
      const original = initial?.[field.key]
      const originalText = original === null || original === undefined ? '' : String(original)

      if (editing ? value === originalText : value === '') continue

      payload[overrides[field.key] ?? field.key] = value
    }

    if ('jobrole' in payload) {
      payload.jobrole_id = values.jobrole_id ?? ''
    }

    if (editing && Object.keys(payload).length === 0) {
      setError('Nothing has changed yet.')
      return
    }

    const result = await onSubmit(payload)

    if (result.ok && isJobRole && !editing && pickedComps.length > 0) {
      const newId = result.createdId ?? null
      if (!newId) {
        setError('The job role was created, but no id came back, so the competencies were not mapped.')
        return
      }
      try {
        await roleRequirementsService.save(
          buildSessionContext(),
          newId,
          pickedComps.map((id) => ({ competency_id: id, required_proficiency: 3, is_mandatory: true })),
        )
      } catch (e) {
        setError(
          e instanceof Error
            ? `The job role was created, but its competencies were not mapped: ${e.message}`
            : 'The job role was created, but its competencies were not mapped.',
        )
        return
      }
    }

    if (result.ok) onSaved()
    else setError(result.message)
  }

  return (
    <>
      <DialogHeader className="p-6 pb-4 border-b border-primary/10 m-0">
        <DialogTitle className="text-xl font-bold text-foreground">
          {editing ? `Edit ${config.singular}` : `Add ${config.singular}`}
        </DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          {editing
            ? 'Only the fields you change are saved.'
            : `Add a new entry to the ${config.plural.toLowerCase()} library.`}
        </DialogDescription>
      </DialogHeader>

      <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto g2g-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {essentials.map(renderField)}
        </div>

        {advanced.length > 0 && (
          <div className="rounded-lg border border-border/70">
            <button
              type="button"
              onClick={() => setShowAdvanced((open) => !open)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-foreground"
            >
              <span>
                More details
                <span className="ml-2 font-normal text-muted-foreground">
                  {advanced.length} optional field{advanced.length === 1 ? '' : 's'}
                </span>
              </span>
              <span className="text-muted-foreground">{showAdvanced ? '−' : '+'}</span>
            </button>
            {showAdvanced && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-border/70 p-4">
                {advanced.map(renderField)}
              </div>
            )}
          </div>
        )}

        {isJobRole && (
          <div className="flex flex-col gap-1.5 border-t border-border/70 pt-4">
            <span className="text-sm font-semibold text-foreground">What this role requires</span>
            <span className="mb-1 text-xs text-muted-foreground">
              The competencies this role demands. Gaps are measured against these.
            </span>

            {editing && initial ? (
              <RoleCompetencyInlinePanel jobroleId={Number(initial.id)} />
            ) : (
              <div className="flex flex-col gap-2">
                {pickedComps.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {pickedComps.map((id) => (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs"
                      >
                        {roleLibrary.find((c) => c.id === id)?.name ?? `#${id}`}
                        <button
                          type="button"
                          aria-label="Remove competency"
                          onClick={() => setPickedComps((current) => current.filter((x) => x !== id))}
                          className="text-muted-foreground transition hover:text-destructive"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <SearchableSelect
                  options={roleLibrary
                    .filter((c) => !pickedComps.includes(c.id))
                    .map((c) => ({ label: c.name, value: String(c.id) }))}
                  value=""
                  onChange={(next) => {
                    const id = Number(next)
                    if (id && !pickedComps.includes(id)) setPickedComps((current) => [...current, id])
                  }}
                  placeholder={roleLibrary.length ? "Add a competency this role requires…" : roleLibraryError ? "Competency library could not be loaded" : "No competencies in this library yet"}
                  searchPlaceholder="Search competencies…"
                  emptyMessage="No competency matches that search"
                  disabled={!roleLibrary.length}
                  className="w-full"
                  aria-label="Add a competency this role requires"
                />
                {roleLibraryError ? (
                  <span className="text-xs text-destructive">{roleLibraryError}</span>
                ) : !roleLibrary.length ? (
                  <span className="text-xs text-muted-foreground">
                    This organisation has no competencies yet — create them in Competency Library
                    first, then they can be required here.
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Saved at level 3 right after the role is created, and editable afterwards.
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      </div>

      <DialogFooter className="p-6 pt-4 border-t border-primary/5 bg-muted/10 m-0">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={saving}
          className="h-9 px-6 rounded-lg font-bold border-border bg-background"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={saving}
          className="h-9 px-6 rounded-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {saving ? 'Saving…' : editing ? 'Save Changes' : `Add ${config.singular}`}
        </Button>
      </DialogFooter>
    </>
  )
}
