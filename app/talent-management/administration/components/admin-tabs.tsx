'use client'

/**
 * Talent Management -> Administration & Governance: Templates, Permissions, Integrations,
 * Configuration and Audit & Compliance tabs. Backed by `GovernanceService`
 * (`_lib/administration-api.ts`) -> `AdminGovernanceController`.
 *
 * Permissions is read only on purpose: access to the Talent Management HR screens is decided by the
 * profile-name rule in `RequireHrRole`, so this tab shows who that rule lets in rather than offering
 * switches that would do nothing.
 */

import React, { useCallback, useEffect, useState } from 'react'
import {
  Archive,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Loader2,
  Pencil,
  Plug,
  Plus,
  Save,
  Search,
  Trash2,
  Unplug,
  AlertTriangle,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/g2g/button'
import { Input } from '@/components/ui/g2g/input'
import { Select } from '@/components/ui/g2g/select'
import { Card } from '@/components/ui/g2g/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/g2g/table'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { toast } from '@/components/result/toast'
import { cn } from '@/lib/utils'
import {
  GovernanceService,
  buildSessionContext,
  isAdministrationSessionReady,
  type AdminAuditEvent,
  type AdminIntegration,
  type AdminRole,
  type AdminSetting,
  type AdminTemplate,
  type ApiFailure,
  type SmtpInput,
  type GovPagination,
} from '../../_lib/administration-api'

const TABLE_CLASS =
  'w-full text-sm [&_td]:px-4 [&_td]:py-3 [&_td]:align-middle [&_th]:whitespace-nowrap [&_th]:px-4 [&_th]:text-xs [&_th]:uppercase [&_th]:tracking-wider [&_tr]:border-border/60'
const FIELD = 'h-9 w-full rounded-lg border border-border bg-card px-3 text-sm shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'

function useSession() {
  const session = buildSessionContext()
  return isAdministrationSessionReady(session) ? session : null
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Try again.'
}

function Pill({ tone, children }: { tone: 'green' | 'amber' | 'gray' | 'red' | 'blue'; children: React.ReactNode }) {
  const tones = {
    green: 'border-success/30 bg-success/10 text-success',
    amber: 'border-warning/40 bg-warning/10 text-warning-foreground',
    gray: 'border-border bg-muted text-muted-foreground',
    red: 'border-destructive/30 bg-destructive/10 text-destructive',
    blue: 'border-primary/25 bg-primary/10 text-primary',
  }
  return <span className={cn('inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold', tones[tone])}>{children}</span>
}

function statusTone(status: string): 'green' | 'amber' | 'gray' | 'red' {
  if (status === 'Active' || status === 'Connected') return 'green'
  if (status === 'Draft') return 'amber'
  if (status === 'Error') return 'red'
  return 'gray'
}

function Panel({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="max-w-[1400px] overflow-hidden border-border/60 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 p-5">
        <div>
          <h3 className="text-lg font-bold text-foreground">{title}</h3>
          {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </Card>
  )
}

function Loading() {
  return (
    <div className="flex h-40 items-center justify-center">
      <Loader2 className="size-6 animate-spin text-primary" />
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">{text}</div>
}

function SearchBox({ value, onChange, onEnter, placeholder }: { value: string; onChange: (v: string) => void; onEnter: () => void; placeholder: string }) {
  return (
    <div className="relative w-[240px]">
      <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
      <Input
        value={value}
        placeholder={placeholder}
        className="h-9 border-border bg-card pl-8 text-sm shadow-sm"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter()}
      />
    </div>
  )
}

function Pager({ p, onPage, noun }: { p: GovPagination | null; onPage: (page: number) => void; noun: string }) {
  if (!p) return null
  const from = p.total === 0 ? 0 : (p.current_page - 1) * p.per_page + 1
  const to = Math.min(p.total, p.current_page * p.per_page)
  return (
    <div className="flex items-center justify-between border-t border-border/60 px-5 py-3 text-xs text-muted-foreground">
      <span>
        Showing {from} to {to} of {p.total} {noun}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-7 w-7" disabled={p.current_page <= 1} onClick={() => onPage(p.current_page - 1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="px-2 font-medium text-foreground">
          Page {p.current_page} of {p.last_page}
        </span>
        <Button variant="outline" size="icon" className="h-7 w-7" disabled={p.current_page >= p.last_page} onClick={() => onPage(p.current_page + 1)}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────── Templates

const TEMPLATE_MODULES = ['Recruitment', 'Onboarding', 'Performance', 'Mobility', 'Offboarding']

interface TemplateForm {
  name: string
  category: string
  module: string
  status: string
  version: string
  description: string
  body: string
}

const blankTemplate = (category: string): TemplateForm => ({ name: '', category, module: '', status: 'Draft', version: '1.0', description: '', body: '' })

export function TemplatesTab({ onChanged }: { onChanged: () => void }) {
  const session = useSession()
  const [rows, setRows] = useState<AdminTemplate[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [pagination, setPagination] = useState<GovPagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<AdminTemplate | 'new' | null>(null)
  const [form, setForm] = useState<TemplateForm>(blankTemplate('Email'))
  const [saving, setSaving] = useState(false)

  const load = useCallback(
    async (searchText = search) => {
      if (!session) return setLoading(false)
      setLoading(true)
      try {
        const res = await GovernanceService.templates(session, {
          page,
          category: category === 'all' ? undefined : category,
          status: status === 'all' ? undefined : status,
          search: searchText || undefined,
        })
        setRows(res.data)
        setCategories(res.categories)
        setPagination(res.pagination ?? null)
      } catch (error) {
        toast.error('Could not load templates', errorMessage(error))
      } finally {
        setLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page, category, status],
  )

  useEffect(() => {
    void Promise.resolve().then(() => load())
  }, [load])

  const openNew = () => {
    setForm(blankTemplate(categories[0] ?? 'Email'))
    setEditing('new')
  }
  const openEdit = (t: AdminTemplate) => {
    setForm({ name: t.name, category: t.category, module: t.module ?? '', status: t.status, version: t.version, description: (t.description ?? '').replace(/^\[demo\]\s*/, ''), body: t.body ?? '' })
    setEditing(t)
  }

  const save = async () => {
    if (!session || !form.name.trim()) return toast.error('Name is required')
    setSaving(true)
    try {
      const payload = { ...form, module: form.module || null, description: form.description || null, body: form.body || null }
      if (editing === 'new') await GovernanceService.createTemplate(session, payload)
      else if (editing) await GovernanceService.updateTemplate(session, editing.id, payload)
      toast.success(editing === 'new' ? 'Template created' : 'Template saved')
      setEditing(null)
      await load()
      onChanged()
    } catch (error) {
      toast.error('Could not save the template', errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const setStatusOf = async (t: AdminTemplate, next: string) => {
    if (!session) return
    try {
      await GovernanceService.updateTemplate(session, t.id, { status: next })
      toast.success(`Template ${next === 'Archived' ? 'archived' : 'activated'}`)
      await load()
      onChanged()
    } catch (error) {
      toast.error('Could not update the template', errorMessage(error))
    }
  }

  const remove = async (t: AdminTemplate) => {
    if (!session || !window.confirm(`Delete the template "${t.name}"?`)) return
    try {
      await GovernanceService.deleteTemplate(session, t.id)
      toast.success('Template deleted')
      await load()
      onChanged()
    } catch (error) {
      toast.error('Could not delete the template', errorMessage(error))
    }
  }

  return (
    <>
      <Panel
        title="Templates"
        subtitle="Offer letters, review forms, checklists and emails used across Talent Management."
        actions={
          <>
            <div className="w-[180px]">
              <Select value={category} onChange={(v) => { setCategory(v); setPage(1) }} options={[{ label: 'All Categories', value: 'all' }, ...categories.map((c) => ({ label: c, value: c }))]} size="sm" />
            </div>
            <div className="w-[140px]">
              <Select value={status} onChange={(v) => { setStatus(v); setPage(1) }} options={[{ label: 'All Status', value: 'all' }, ...['Active', 'Draft', 'Archived'].map((c) => ({ label: c, value: c }))]} size="sm" />
            </div>
            <SearchBox value={search} onChange={setSearch} onEnter={() => { setPage(1); void load(search) }} placeholder="Search templates... (Press Enter)" />
            <Button className="gap-2" onClick={openNew}>
              <Plus className="size-4" /> New Template
            </Button>
          </>
        }
      >
        {loading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty text="No templates found." />
        ) : (
          <div className="overflow-x-auto">
            <Table className={TABLE_CLASS}>
              <TableHeader className="bg-primary/5">
                <TableRow>
                  <TableHead>Template</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((t) => (
                  <TableRow key={t.id} className="cursor-pointer border-t transition-colors hover:bg-primary/5" onClick={() => openEdit(t)}>
                    <TableCell>
                      <div className="font-semibold text-foreground">{t.name}</div>
                      {t.description && <div className="max-w-[420px] truncate text-xs text-muted-foreground">{t.description.replace(/^\[demo\]\s*/, '')}</div>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{t.category}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{t.module ?? '—'}</TableCell>
                    <TableCell>
                      <Pill tone={statusTone(t.status)}>{t.status}</Pill>
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">v{t.version}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{t.lastUpdated}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" title="Edit" onClick={() => openEdit(t)}>
                          <Pencil className="size-4" />
                        </Button>
                        {t.status === 'Archived' ? (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" title="Reactivate" onClick={() => setStatusOf(t, 'Active')}>
                            <CheckCircle2 className="size-4" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" title="Archive" onClick={() => setStatusOf(t, 'Archived')}>
                            <Archive className="size-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" title="Delete" onClick={() => remove(t)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <Pager p={pagination} onPage={setPage} noun="templates" />
      </Panel>

      <Sheet open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <SheetContent side="right" className="flex w-[95vw] flex-col gap-0 p-0 sm:max-w-xl">
          <div className="flex items-center border-b px-6 py-4 pr-14">
            <h2 className="text-lg font-bold">{editing === 'new' ? 'New template' : 'Edit template'}</h2>
          </div>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Name
              <input className={FIELD} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Category
                <select className={FIELD} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Module
                <select className={FIELD} value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value })}>
                  <option value="">—</option>
                  {TEMPLATE_MODULES.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Status
                <select className={FIELD} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {['Active', 'Draft', 'Archived'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Version
                <input className={FIELD} value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} />
              </label>
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Description
              <input className={FIELD} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Content
              <textarea
                className="min-h-[220px] w-full rounded-lg border border-border bg-card p-3 font-mono text-xs shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                value={form.body}
                placeholder="Use {placeholders} such as {candidate_name} or {job_title}."
                onChange={(e) => setForm({ ...form, body: e.target.value })}
              />
            </label>
          </div>
          <div className="flex justify-end gap-2 border-t px-6 py-4">
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button className="gap-2" disabled={saving} onClick={save}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

// ──────────────────────────────────────────────────────────── Permissions

export function PermissionsTab() {
  const session = useSession()
  const [rows, setRows] = useState<AdminRole[]>([])
  const [keywords, setKeywords] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [onlyHr, setOnlyHr] = useState(false)

  useEffect(() => {
    if (!session) {
      void Promise.resolve().then(() => setLoading(false))
      return
    }
    GovernanceService.permissions(session)
      .then((res) => {
        setRows(res.data)
        setKeywords(res.keywords)
      })
      .catch((error) => toast.error('Could not load roles', errorMessage(error)))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const shown = onlyHr ? rows.filter((r) => r.hrAccess) : rows
  const areaNames = rows[0] ? Object.keys(rows[0].areas) : []

  return (
    <Panel
      title="Permissions"
      subtitle="Which user roles can open and manage the Talent Management screens."
      actions={
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <input type="checkbox" className="size-4 accent-[hsl(221_83%_53%)]" checked={onlyHr} onChange={(e) => setOnlyHr(e.target.checked)} />
          Only roles with access
        </label>
      }
    >
      <div className="flex items-start gap-3 border-b border-border/60 bg-primary/5 px-5 py-3 text-sm text-foreground/80">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          Access follows the role name: a role whose name contains <strong>{keywords.join(', ')}</strong> can manage every Talent Management area, all other roles have no access. To change who gets in, rename the role or
          update the HR keywords in the server settings.
        </p>
      </div>
      {loading ? (
        <Loading />
      ) : shown.length === 0 ? (
        <Empty text="No roles found." />
      ) : (
        <div className="overflow-x-auto">
          <Table className={TABLE_CLASS}>
            <TableHeader className="bg-primary/5">
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Active users</TableHead>
                <TableHead>Talent access</TableHead>
                {areaNames.map((a) => (
                  <TableHead key={a} className="text-center">
                    {a}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((r) => (
                <TableRow key={r.id} className="border-t transition-colors hover:bg-primary/5">
                  <TableCell>
                    <div className="font-semibold text-foreground">{r.role}</div>
                    {r.description && r.description !== r.role && <div className="text-xs text-muted-foreground">{r.description}</div>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.users}</TableCell>
                  <TableCell>{r.hrAccess ? <Pill tone="green">Full access</Pill> : <Pill tone="gray">No access</Pill>}</TableCell>
                  {areaNames.map((a) => (
                    <TableCell key={a} className="text-center">
                      {r.areas[a] === 'Manage' ? <CheckCircle2 className="mx-auto size-4 text-success" /> : <span className="text-muted-foreground/50">—</span>}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Panel>
  )
}

// ────────────────────────────────────────────────────────── Integrations

// ──────────────────────────────────────────────────────── Setup guides

/** Step by step "how do I get a Client ID and Secret" for each provider, shown in the setup panel. */
const SETUP_GUIDES: Record<string, { consoleName: string; links?: Array<{ label: string; href: string }>; steps: string[]; note?: string }> = {
  google: {
    consoleName: 'Google Cloud Console',
    links: [
      { label: 'Open Credentials', href: 'https://console.cloud.google.com/apis/credentials' },
      { label: 'Enable Google Calendar API', href: 'https://console.cloud.google.com/apis/library/calendar-json.googleapis.com' },
    ],
    steps: [
      'Open the Google Cloud Console (Credentials link above) and pick your project from the project menu at the top.',
      'Click "Enable Google Calendar API" above, then press Enable. Skip this if it already says API enabled.',
      'First time only: if Google asks you to configure the consent screen, choose "Get started". Enter an app name (for example your school name) and your support email, choose Audience "External", add your contact email, accept the policy and press Create.',
      'Go back to Credentials. Click "+ Create credentials", then "OAuth client ID".',
      'Application type: "Web application". Name: anything, for example "ERP Talent Management".',
      'Scroll to "Authorized redirect URIs", click "+ Add URI" and paste the redirect URL from the box above. It must match exactly, with no spaces and no slash at the end. Leave "Authorized JavaScript origins" empty.',
      'Click Create. A window shows your Client ID and Client secret. Copy both now: Google shows the secret only this once.',
      'If your app is in "Testing" mode, open Google Auth Platform, then Audience, then Test users, and add the Google accounts that will connect. Anyone else will see "access blocked".',
      'Paste the Client ID and Client secret below and press Save.',
    ],
    note: 'In Google Auth Platform, Data access, make sure the Google Calendar events scope (.../auth/calendar.events) is added.',
  },
  microsoft: {
    consoleName: 'Microsoft Entra admin center',
    links: [{ label: 'Open App registrations', href: 'https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade' }],
    steps: [
      'Open App registrations (link above) and click "New registration".',
      'Name: anything, for example "ERP Talent Management". Supported account types: "Accounts in any organizational directory and personal Microsoft accounts".',
      'Redirect URI: choose platform "Web" and paste the redirect URL from the box above. Click Register.',
      'On the Overview page copy the "Application (client) ID". This is your Client ID.',
      'Open "Certificates & secrets", then "New client secret". Add a description and an expiry, press Add, and copy the secret "Value" straight away. It is hidden later. (Copy Value, not Secret ID.)',
      'Open "API permissions", "Add a permission", "Microsoft Graph", "Delegated permissions". Add User.Read, Calendars.ReadWrite and offline_access.',
      'Paste the Client ID and the secret Value below and press Save.',
    ],
  },
  linkedin: {
    consoleName: 'LinkedIn Developers',
    links: [{ label: 'Open LinkedIn Developers', href: 'https://www.linkedin.com/developers/apps' }],
    steps: [
      'Open LinkedIn Developers (link above) and click "Create app".',
      'Enter an app name, choose your LinkedIn Company Page (you need one; create it first if not), upload a logo, accept the terms and press Create app.',
      'Open the "Products" tab and request "Sign In with LinkedIn using OpenID Connect". It is approved instantly.',
      'Open the "Auth" tab. Under "OAuth 2.0 settings" click the pencil next to "Authorized redirect URLs for your app", add the redirect URL from the box above and Update.',
      'On the same Auth tab copy the "Client ID" and the "Primary Client Secret" (click the eye icon to reveal it).',
      'Paste them below and press Save.',
    ],
    note: 'Posting jobs to LinkedIn needs LinkedIn partner approval. This connection only signs in.',
  },
  docusign: {
    consoleName: 'DocuSign Admin',
    links: [{ label: 'Open Apps and Keys (developer sandbox)', href: 'https://admindemo.docusign.com/apps-and-keys' }],
    steps: [
      'Open Apps and Keys (link above), sign in, and click "Add App and Integration Key".',
      'Enter an app name, then copy the "Integration Key". This is your Client ID.',
      'Under "Authentication" choose "Authorization Code Grant". Click "Add Secret Key" and copy the secret straight away; it is shown only once.',
      'Under "Additional settings" click "Add URI" and paste the redirect URL from the box above. Press Save.',
      'Paste the Integration Key and the secret below and press Save.',
    ],
    note: 'This uses the DocuSign developer sandbox. For real signing, DocuSign must approve a Go-Live first; then set the platform to production.',
  },
}

function CopyBox({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-stretch gap-2">
      <code className="block min-w-0 flex-1 break-all rounded-lg border border-border bg-muted px-3 py-2 text-xs">{text}</code>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0"
        onClick={() => {
          void navigator.clipboard?.writeText(text).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          })
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  )
}

export function IntegrationsTab({ onChanged }: { onChanged: () => void }) {
  const session = useSession()
  const [rows, setRows] = useState<AdminIntegration[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [category, setCategory] = useState('all')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [setup, setSetup] = useState<{ integration: AdminIntegration; provider: string; label: string; canSetup: boolean; scope: 'platform' | 'school'; redirect: string; url: string } | null>(null)
  const [appKeys, setAppKeys] = useState({ clientId: '', clientSecret: '' })
  const [smtpFor, setSmtpFor] = useState<AdminIntegration | null>(null)
  const [smtp, setSmtp] = useState<SmtpInput>({ host: '', port: 587, username: '', password: '', encryption: 'tls' })

  const load = useCallback(async () => {
    if (!session) return setLoading(false)
    try {
      const res = await GovernanceService.integrations(session, category === 'all' ? undefined : category)
      setRows(res.data)
      setCategories(res.categories)
    } catch (error) {
      toast.error('Could not load integrations', errorMessage(error))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category])

  useEffect(() => {
    void Promise.resolve().then(() => load())
  }, [load])

  // Back from the provider's site: the server adds ?integration=connected|error&detail=... to the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const result = params.get('integration')
    if (!result) return
    const detail = params.get('detail') ?? ''
    if (result === 'connected') toast.success(`${detail || 'Integration'} connected`)
    else toast.error('Could not connect', detail || 'The provider did not complete the sign-in.')
    params.delete('integration')
    params.delete('detail')
    const query = params.toString()
    window.history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : ''))
  }, [])

  const connect = async (i: AdminIntegration) => {
    if (!session) return
    if (i.kind === 'smtp') {
      setSmtpFor(i)
      return
    }
    setBusy(i.id)
    try {
      const res = await GovernanceService.connectIntegration(session, i.id, { return_url: window.location.href })
      if (res.data.url) window.location.assign(res.data.url)
    } catch (error) {
      const failure = error as ApiFailure
      if (failure.payload?.setup_required) {
        setAppKeys({ clientId: '', clientSecret: '' })
        setSetup({
          integration: i,
          provider: failure.payload.provider ?? '',
          label: failure.payload.provider_label ?? i.name,
          canSetup: Boolean(failure.payload.can_setup),
          scope: failure.payload.scope ?? 'school',
          redirect: failure.payload.redirect_uri ?? '',
          url: failure.payload.console_url ?? '',
        })
      } else {
        toast.error('Could not connect', errorMessage(error))
      }
      setBusy(null)
    }
  }

  const saveApp = async () => {
    if (!session || !setup) return
    setBusy(setup.integration.id)
    try {
      await GovernanceService.saveOauthApp(session, setup.provider, appKeys.clientId, appKeys.clientSecret)
      toast.success(`${setup.label} sign-in enabled`)
      const integration = setup.integration
      setSetup(null)
      setBusy(null)
      await connect(integration)
    } catch (error) {
      toast.error('Could not save the keys', errorMessage(error))
      setBusy(null)
    }
  }

  const saveSmtp = async () => {
    if (!session || !smtpFor) return
    setBusy(smtpFor.id)
    try {
      await GovernanceService.connectIntegration(session, smtpFor.id, smtp)
      toast.success(`${smtpFor.name} connected`)
      setSmtpFor(null)
      setSmtp({ ...smtp, password: '' })
      await load()
      onChanged()
    } catch (error) {
      toast.error('Could not connect', errorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  const testConnection = async (i: AdminIntegration) => {
    if (!session) return
    setBusy(i.id)
    try {
      const res = await GovernanceService.testIntegration(session, i.id)
      toast.success('Connection works', res.message)
    } catch (error) {
      toast.error('Connection test failed', errorMessage(error))
    } finally {
      setBusy(null)
      await load()
    }
  }

  const disconnect = async (i: AdminIntegration) => {
    if (!session || !window.confirm(`Disconnect ${i.name}? Saved sign-in details are removed.`)) return
    setBusy(i.id)
    try {
      await GovernanceService.disconnectIntegration(session, i.id)
      toast.success(`${i.name} disconnected`)
      await load()
      onChanged()
    } catch (error) {
      toast.error('Could not disconnect', errorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <Panel
        title="Integrations"
        subtitle="Job boards, calendars, email and other systems connected to Talent Management."
        actions={
          <div className="w-[180px]">
            <Select value={category} onChange={setCategory} options={[{ label: 'All Categories', value: 'all' }, ...categories.map((c) => ({ label: c, value: c }))]} size="sm" />
          </div>
        }
      >
        {loading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty text="No integrations found." />
        ) : (
          <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((i) => {
              const connected = i.status === 'Connected'
              const working = busy === i.id
              return (
                <div key={i.id} className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg border border-primary/20 bg-primary/10 p-2 text-primary">
                        <Plug className="size-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{i.name}</div>
                        <div className="text-xs text-muted-foreground">{i.category}</div>
                      </div>
                    </div>
                    <Pill tone={statusTone(i.status)}>{i.status === 'Disconnected' ? 'Not connected' : i.status}</Pill>
                  </div>
                  {i.description && <p className="text-sm text-muted-foreground">{i.description.replace(/^\[demo\]\s*/, '')}</p>}
                  {connected && i.account && (
                    <div className="rounded-lg border border-success/25 bg-success/5 px-3 py-1.5 text-xs text-foreground/80">
                      Connected as <span className="font-semibold">{i.account}</span>
                    </div>
                  )}
                  {connected && i.providerLabel === 'Google' && (
                    <p className="text-xs text-muted-foreground">
                      Interviews scheduled in Recruitment are added to this Google Calendar, and the interviewers and candidate get an invite. Look for them at calendar.google.com.
                    </p>
                  )}
                  <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                    <div className={cn('flex min-w-0 items-center gap-1.5 text-xs', i.status === 'Error' ? 'text-destructive' : 'text-muted-foreground')}>
                      {i.status === 'Error' ? <AlertTriangle className="size-3.5 shrink-0" /> : <Clock className="size-3.5 shrink-0" />}
                      <span className="truncate">
                        {i.lastSyncNote ?? (i.lastSync ? `Synced ${i.lastSync}` : i.kind === 'unavailable' ? 'Connector coming soon' : i.setupRequired ? 'Needs setup on the server' : 'Not connected yet')}
                      </span>
                    </div>
                    {i.kind === 'builtin' ? (
                      <span className="shrink-0 text-xs font-semibold text-success">Always on</span>
                    ) : i.kind === 'unavailable' ? (
                      <Button variant="outline" size="sm" className="shrink-0" disabled>
                        Coming soon
                      </Button>
                    ) : connected ? (
                      <div className="flex shrink-0 gap-2">
                        {i.providerLabel === 'Google' && (
                          <Button variant="outline" size="sm" className="gap-1.5" disabled={working} onClick={() => testConnection(i)}>
                            {working ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />} Test
                          </Button>
                        )}
                        <Button variant="outline" size="sm" className="gap-1.5" disabled={working} onClick={() => disconnect(i)}>
                          {working ? <Loader2 className="size-3.5 animate-spin" /> : <Unplug className="size-3.5" />} Disconnect
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" className="shrink-0 gap-1.5" disabled={working} onClick={() => connect(i)}>
                        {working ? <Loader2 className="size-3.5 animate-spin" /> : <ExternalLink className="size-3.5" />}
                        {i.kind === 'oauth' ? `Connect with ${i.providerLabel ?? 'provider'}` : 'Connect'}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      <Sheet open={setup !== null} onOpenChange={(open) => !open && setSetup(null)}>
        <SheetContent side="right" className="flex w-[95vw] flex-col gap-0 p-0 sm:max-w-lg">
          <div className="flex items-center border-b px-6 py-4 pr-14">
            <h2 className="text-lg font-bold">{setup?.label} is not enabled yet</h2>
          </div>
          {setup && !setup.canSetup ? (
            <div className="flex flex-col gap-3 p-6 text-sm">
              <p className="text-foreground">
                Connecting to {setup.label} has not been switched on yet.
              </p>
              <p className="text-muted-foreground">Ask your platform administrator (Super Admin) to enable it from this Integrations tab. After that, Connect takes you straight to {setup.label}&apos;s own sign-in page.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6 text-sm">
                <p className="text-foreground">
                  {setup?.scope === 'platform'
                    ? `You are a Super Admin, so this switches ${setup?.label} on for every school. After that, each school just clicks Connect and signs in on ${setup?.label}'s own page.`
                    : `Add your school's ${setup?.label} app details once. After that, Connect takes you (and your colleagues) straight to ${setup?.label}'s own sign-in page. This is saved for your school only.`}
                  {' '}Nobody edits any server file.
                </p>
                <div className="flex flex-col gap-1.5">
                  <span className="font-semibold text-foreground">Your redirect URL</span>
                  <CopyBox text={setup?.redirect ?? ''} />
                  <span className="text-xs text-muted-foreground">You will paste this into {SETUP_GUIDES[setup?.provider ?? '']?.consoleName ?? 'the provider'} in the steps below.</span>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="font-semibold text-foreground">How to get your Client ID and Secret</span>
                  <div className="flex flex-wrap gap-2">
                    {(SETUP_GUIDES[setup?.provider ?? '']?.links ?? [{ label: 'Open developer console', href: setup?.url ?? '#' }]).map((l) => (
                      <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10">
                        <ExternalLink className="size-3.5" /> {l.label}
                      </a>
                    ))}
                  </div>
                  <ol className="flex list-decimal flex-col gap-2.5 pl-5 text-foreground/90">
                    {(SETUP_GUIDES[setup?.provider ?? '']?.steps ?? ['Create an app in the provider\'s developer console, add the redirect URL above, then copy its Client ID and Client Secret.']).map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                  {SETUP_GUIDES[setup?.provider ?? '']?.note && (
                    <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground/80">{SETUP_GUIDES[setup?.provider ?? '']?.note}</p>
                  )}
                </div>
                <label className="flex flex-col gap-1.5 font-medium">
                  Client ID
                  <input className={FIELD} autoComplete="off" value={appKeys.clientId} onChange={(e) => setAppKeys({ ...appKeys, clientId: e.target.value })} />
                </label>
                <label className="flex flex-col gap-1.5 font-medium">
                  Client Secret
                  <input className={FIELD} type="password" autoComplete="new-password" value={appKeys.clientSecret} onChange={(e) => setAppKeys({ ...appKeys, clientSecret: e.target.value })} />
                </label>
                <p className="text-xs text-muted-foreground">The secret is stored encrypted and is never shown again.</p>
              </div>
              <div className="flex justify-end gap-2 border-t px-6 py-4">
                <Button variant="outline" onClick={() => setSetup(null)}>
                  Cancel
                </Button>
                <Button className="gap-2" disabled={busy !== null || !appKeys.clientId.trim() || !appKeys.clientSecret.trim()} onClick={saveApp}>
                  {busy !== null ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />} Save &amp; continue to {setup?.label}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={smtpFor !== null} onOpenChange={(open) => !open && setSmtpFor(null)}>
        <SheetContent side="right" className="flex w-[95vw] flex-col gap-0 p-0 sm:max-w-lg">
          <div className="flex items-center border-b px-6 py-4 pr-14">
            <h2 className="text-lg font-bold">Connect {smtpFor?.name}</h2>
          </div>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
            <p className="text-sm text-muted-foreground">We sign in to the mail server to check these details. Nothing is saved unless the sign-in works.</p>
            <div className="grid grid-cols-3 gap-4">
              <label className="col-span-2 flex flex-col gap-1.5 text-sm font-medium">
                Server
                <input className={FIELD} placeholder="smtp.example.com" value={smtp.host} onChange={(e) => setSmtp({ ...smtp, host: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Port
                <input className={FIELD} type="number" value={smtp.port} onChange={(e) => setSmtp({ ...smtp, port: Number(e.target.value) })} />
              </label>
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Username
              <input className={FIELD} autoComplete="off" value={smtp.username} onChange={(e) => setSmtp({ ...smtp, username: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Password
              <input className={FIELD} type="password" autoComplete="new-password" value={smtp.password} onChange={(e) => setSmtp({ ...smtp, password: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Security
              <select className={FIELD} value={smtp.encryption} onChange={(e) => setSmtp({ ...smtp, encryption: e.target.value as SmtpInput['encryption'] })}>
                <option value="tls">STARTTLS (usually port 587)</option>
                <option value="ssl">SSL / TLS (usually port 465)</option>
                <option value="none">None</option>
              </select>
            </label>
          </div>
          <div className="flex justify-end gap-2 border-t px-6 py-4">
            <Button variant="outline" onClick={() => setSmtpFor(null)}>
              Cancel
            </Button>
            <Button className="gap-2" disabled={busy !== null || !smtp.host || !smtp.username || !smtp.password} onClick={saveSmtp}>
              {busy !== null ? <Loader2 className="size-4 animate-spin" /> : <Plug className="size-4" />} Test &amp; connect
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

// ────────────────────────────────────────────────────────── Configuration

export function ConfigurationTab({ onChanged }: { onChanged: () => void }) {
  const session = useSession()
  const [settings, setSettings] = useState<AdminSetting[]>([])
  const [draft, setDraft] = useState<Record<string, number | boolean | string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!session) return setLoading(false)
    try {
      const res = await GovernanceService.settings(session)
      setSettings(res.data)
      setDraft(Object.fromEntries(res.data.map((s) => [s.key, s.value])))
    } catch (error) {
      toast.error('Could not load settings', errorMessage(error))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void Promise.resolve().then(() => load())
  }, [load])

  const dirty = settings.filter((s) => draft[s.key] !== s.value)
  const groups = Array.from(new Set(settings.map((s) => s.group)))

  const save = async () => {
    if (!session || dirty.length === 0) return
    setSaving(true)
    try {
      await GovernanceService.saveSettings(session, Object.fromEntries(dirty.map((s) => [s.key, draft[s.key]])))
      toast.success('Settings saved')
      await load()
      onChanged()
    } catch (error) {
      toast.error('Could not save settings', errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel
      title="Configuration"
      subtitle="Defaults that apply across recruitment, onboarding, performance and governance."
      actions={
        <>
          {dirty.length > 0 && <span className="text-xs font-medium text-muted-foreground">{dirty.length} unsaved change{dirty.length > 1 ? 's' : ''}</span>}
          <Button variant="outline" disabled={dirty.length === 0 || saving} onClick={() => setDraft(Object.fromEntries(settings.map((s) => [s.key, s.value])))}>
            Reset
          </Button>
          <Button className="gap-2" disabled={dirty.length === 0 || saving} onClick={save}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save changes
          </Button>
        </>
      }
    >
      {loading ? (
        <Loading />
      ) : (
        <div className="grid gap-5 p-5 lg:grid-cols-2">
          {groups.map((group) => (
            <div key={group} className="rounded-xl border border-border/60 bg-card shadow-sm">
              <div className="border-b border-border/60 bg-primary/5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-primary">{group}</div>
              <div className="divide-y divide-border/60">
                {settings
                  .filter((s) => s.group === group)
                  .map((s) => (
                    <div key={s.key} className="flex items-center justify-between gap-4 px-4 py-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-foreground">{s.label}</div>
                        <div className="text-xs text-muted-foreground">{s.help}</div>
                      </div>
                      {s.type === 'boolean' ? (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={Boolean(draft[s.key])}
                          onClick={() => setDraft({ ...draft, [s.key]: !draft[s.key] })}
                          className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', draft[s.key] ? 'bg-primary' : 'bg-border')}
                        >
                          <span className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', draft[s.key] ? 'left-[22px]' : 'left-0.5')} />
                        </button>
                      ) : s.type === 'select' ? (
                        <select className={cn(FIELD, 'w-36 shrink-0')} value={String(draft[s.key] ?? '')} onChange={(e) => setDraft({ ...draft, [s.key]: e.target.value })}>
                          {(s.options ?? []).map((o) => (
                            <option key={o}>{o}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className={cn(FIELD, 'w-24 shrink-0 text-right')}
                          type={s.type === 'number' ? 'number' : 'text'}
                          min={0}
                          value={String(draft[s.key] ?? '')}
                          onChange={(e) => setDraft({ ...draft, [s.key]: s.type === 'number' ? Number(e.target.value) : e.target.value })}
                        />
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}

// ─────────────────────────────────────────────────────────────── Audit

function actionTone(action: string): 'green' | 'blue' | 'red' | 'amber' | 'gray' {
  if (action === 'created' || action === 'connected') return 'green'
  if (action === 'deleted' || action === 'disconnected') return 'red'
  if (action === 'settings_changed') return 'amber'
  return 'blue'
}

export function AuditTab() {
  const session = useSession()
  const [rows, setRows] = useState<AdminAuditEvent[]>([])
  const [pagination, setPagination] = useState<GovPagination | null>(null)
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [modules, setModules] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [module, setModule] = useState('all')
  const [action, setAction] = useState('all')
  const [search, setSearch] = useState('')

  const load = useCallback(
    async (searchText = search) => {
      if (!session) return setLoading(false)
      setLoading(true)
      try {
        const res = await GovernanceService.audit(session, {
          page,
          module: module === 'all' ? undefined : module,
          action: action === 'all' ? undefined : action,
          search: searchText || undefined,
        })
        setRows(res.data)
        setPagination(res.pagination ?? null)
        setSummary(res.summary)
        setModules(res.modules)
      } catch (error) {
        toast.error('Could not load the audit log', errorMessage(error))
      } finally {
        setLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page, module, action],
  )

  useEffect(() => {
    void Promise.resolve().then(() => load())
  }, [load])

  const total30 = Object.values(summary).reduce((a, b) => a + b, 0)

  return (
    <div className="flex max-w-[1400px] flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <button
          type="button"
          onClick={() => { setModule('all'); setPage(1) }}
          className={cn('rounded-xl border bg-card p-3 text-left shadow-sm transition hover:border-primary/50', module === 'all' ? 'border-primary bg-primary/5' : 'border-border/60')}
        >
          <div className="text-xs font-semibold text-muted-foreground">All (30 days)</div>
          <div className="mt-1 text-2xl font-bold leading-none">{total30}</div>
        </button>
        {Object.entries(summary)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([m, c]) => (
            <button
              key={m}
              type="button"
              onClick={() => { setModule(m); setPage(1) }}
              className={cn('rounded-xl border bg-card p-3 text-left shadow-sm transition hover:border-primary/50', module === m ? 'border-primary bg-primary/5' : 'border-border/60')}
            >
              <div className="text-xs font-semibold text-muted-foreground">{m}</div>
              <div className="mt-1 text-2xl font-bold leading-none">{c}</div>
            </button>
          ))}
      </div>

      <Panel
        title="Audit & Compliance"
        subtitle="Who changed what in Talent Management administration."
        actions={
          <>
            <div className="w-[170px]">
              <Select value={module} onChange={(v) => { setModule(v); setPage(1) }} options={[{ label: 'All Modules', value: 'all' }, ...modules.map((m) => ({ label: m, value: m }))]} size="sm" />
            </div>
            <div className="w-[170px]">
              <Select
                value={action}
                onChange={(v) => { setAction(v); setPage(1) }}
                options={[{ label: 'All Actions', value: 'all' }, ...['created', 'updated', 'deleted', 'connected', 'disconnected', 'settings_changed'].map((a) => ({ label: a.replace('_', ' '), value: a }))]}
                size="sm"
              />
            </div>
            <SearchBox value={search} onChange={setSearch} onEnter={() => { setPage(1); void load(search) }} placeholder="Search events... (Press Enter)" />
          </>
        }
      >
        {loading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty text="No audit events match these filters." />
        ) : (
          <div className="overflow-x-auto">
            <Table className={TABLE_CLASS}>
              <TableHeader className="bg-primary/5">
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((e) => (
                  <TableRow key={e.id} className="border-t transition-colors hover:bg-primary/5">
                    <TableCell className="whitespace-nowrap text-muted-foreground">{e.when}</TableCell>
                    <TableCell className="whitespace-nowrap font-medium">{e.actor}</TableCell>
                    <TableCell className="whitespace-nowrap">{e.module}</TableCell>
                    <TableCell>
                      <Pill tone={actionTone(e.action)}>{e.action.replace('_', ' ')}</Pill>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {e.entity ?? '—'}
                      {e.entityType && <span className="ml-1.5 text-xs text-muted-foreground">({e.entityType})</span>}
                    </TableCell>
                    <TableCell className="max-w-[360px] truncate text-muted-foreground" title={e.details ?? ''}>
                      {(e.details ?? '').replace(/^\[demo\]\s*/, '') || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <Pager p={pagination} onPage={setPage} noun="events" />
      </Panel>
    </div>
  )
}
