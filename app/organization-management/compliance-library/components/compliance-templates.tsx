'use client'

/**
 * Compliance Templates management - Compliance Management,
 * frontend-completion pass. New component; backs the register's "Create
 * from Template" picker (`ComplianceForm`'s `templates`/`onApplyTemplate`
 * props) with somewhere to actually manage those templates. Same
 * tenant-vs-global ownership rule as Categories - see
 * `ComplianceCategories`'s header comment.
 */

import { useState } from 'react'
import { Copy, Edit3, FileText, Plus, Trash2 } from 'lucide-react'
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/g2g/badge'
import { Button } from '@/components/ui/g2g/button'
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from '@/components/ui/g2g/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/g2g/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/g2g/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/g2g/table'
import { Textarea } from '@/components/ui/g2g/textarea'
import { useComplianceTemplates } from '../../_lib/use-compliance-extras'
import { frequencySelectOptions, prioritySelectOptions, TableSkeleton } from './compliance-library-management-shared'
import type { ComplianceCategoryOption, ComplianceTemplateRecord } from '../../_lib/compliance-library-api'

const EMPTY_FORM = { name: '', description: '', category_id: '', default_frequency: '', default_priority: 'Medium' }

export function ComplianceTemplates({ categoryOptions, isAdmin }: { categoryOptions: ComplianceCategoryOption[]; isAdmin: boolean }) {
  const { templates, loading, saving, createTemplate, updateTemplate, duplicateTemplate, deleteTemplate } = useComplianceTemplates()
  const [notice, setNotice] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ComplianceTemplateRecord | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deleting, setDeleting] = useState<ComplianceTemplateRecord | null>(null)

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }
  const openEdit = (template: ComplianceTemplateRecord) => {
    setEditing(template)
    setForm({
      name: template.name,
      description: template.description ?? '',
      category_id: template.category_id ? String(template.category_id) : '',
      default_frequency: template.default_frequency ?? '',
      default_priority: template.default_priority ?? 'Medium',
    })
    setFormOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    const payload = {
      name: form.name.trim(),
      description: form.description || undefined,
      category_id: form.category_id || undefined,
      default_frequency: form.default_frequency || undefined,
      default_priority: form.default_priority || undefined,
    }
    const result = editing ? await updateTemplate(editing.id, payload) : await createTemplate(payload)
    setNotice(result.message)
    if (result.ok) setFormOpen(false)
  }

  const handleDuplicate = async (template: ComplianceTemplateRecord) => {
    const result = await duplicateTemplate(template.id)
    setNotice(result.message)
  }

  const handleDelete = async () => {
    if (!deleting) return
    const result = await deleteTemplate(deleting.id)
    setNotice(result.message)
    setDeleting(null)
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="size-5 text-primary" /> Compliance Templates
          </CardTitle>
          <CardDescription>Reusable starting points for common inspections and renewals - pick one when creating a compliance record.</CardDescription>
        </div>
        {isAdmin && (
          <Button className="gap-2" onClick={openCreate}>
            <Plus className="size-4" /> Add Template
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {notice && <div className="mx-4 mb-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">{notice}</div>}
        {loading ? (
          <TableSkeleton />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Default Frequency</TableHead>
                <TableHead>Default Priority</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead className="w-40 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium text-foreground">{template.name}</TableCell>
                  <TableCell>{template.category_name ?? '-'}</TableCell>
                  <TableCell>{template.default_frequency ?? '-'}</TableCell>
                  <TableCell>{template.default_priority ?? '-'}</TableCell>
                  <TableCell>
                    <Badge variant={template.is_global ? 'muted' : 'navy'}>{template.is_global ? 'Platform default' : 'This school'}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {isAdmin && (
                        <Button variant="ghost" size="icon-sm" aria-label={`Duplicate ${template.name}`} onClick={() => handleDuplicate(template)}>
                          <Copy className="size-4" />
                        </Button>
                      )}
                      {isAdmin && !template.is_global && (
                        <>
                          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${template.name}`} onClick={() => openEdit(template)}>
                            <Edit3 className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" aria-label={`Delete ${template.name}`} className="text-destructive" onClick={() => setDeleting(template)}>
                            <Trash2 className="size-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Template' : 'Add Template'}</DialogTitle>
            <DialogDescription>Set the defaults that get applied when a compliance record is created from this template.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label required>Name</Label>
              <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Fire Safety Inspection" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category_id} onChange={(value) => setForm((current) => ({ ...current, category_id: value }))} options={categoryOptions} placeholder="Category" />
              </div>
              <div className="space-y-2">
                <Label>Default Frequency</Label>
                <Select value={form.default_frequency} onChange={(value) => setForm((current) => ({ ...current, default_frequency: value }))} options={frequencySelectOptions} placeholder="Frequency" />
              </div>
              <div className="space-y-2">
                <Label>Default Priority</Label>
                <Select value={form.default_priority} onChange={(value) => setForm((current) => ({ ...current, default_priority: value }))} options={prioritySelectOptions} placeholder="Priority" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>{deleting?.name ? `"${deleting.name}"` : 'This template'} will no longer be available in the Create from Template picker.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
