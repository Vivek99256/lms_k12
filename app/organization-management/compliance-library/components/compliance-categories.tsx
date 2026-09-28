'use client'

/**
 * Compliance Categories management - Compliance Management,
 * frontend-completion pass. New component; no category management existed
 * before (the register's Category field is new too - see
 * `ComplianceCategoryController`). Global platform-default categories
 * (`is_global`) are read-only here, matching the backend's ownership rule
 * (editing/deleting one returns 403) - shown greyed out with no actions
 * rather than letting a click 403 silently.
 */

import { useState } from 'react'
import { Edit3, FolderKanban, Plus, Trash2 } from 'lucide-react'
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/g2g/badge'
import { Button } from '@/components/ui/g2g/button'
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from '@/components/ui/g2g/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/g2g/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/g2g/table'
import { Textarea } from '@/components/ui/g2g/textarea'
import { useComplianceCategories } from '../../_lib/use-compliance-extras'
import { TableSkeleton } from './compliance-library-management-shared'
import type { ComplianceCategoryRecord } from '../../_lib/compliance-library-api'

const EMPTY_FORM = { name: '', description: '' }

export function ComplianceCategories({ isAdmin }: { isAdmin: boolean }) {
  const { categories, loading, saving, createCategory, updateCategory, deleteCategory } = useComplianceCategories()
  const [notice, setNotice] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ComplianceCategoryRecord | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deleting, setDeleting] = useState<ComplianceCategoryRecord | null>(null)

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }
  const openEdit = (category: ComplianceCategoryRecord) => {
    setEditing(category)
    setForm({ name: category.name, description: category.description ?? '' })
    setFormOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    const result = editing
      ? await updateCategory(editing.id, { name: form.name.trim(), description: form.description })
      : await createCategory({ name: form.name.trim(), description: form.description })
    setNotice(result.message)
    if (result.ok) setFormOpen(false)
  }

  const handleToggleStatus = async (category: ComplianceCategoryRecord) => {
    const result = await updateCategory(category.id, { status: !category.status })
    setNotice(result.message)
  }

  const handleDelete = async () => {
    if (!deleting) return
    const result = await deleteCategory(deleting.id)
    setNotice(result.message)
    setDeleting(null)
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FolderKanban className="size-5 text-primary" /> Compliance Categories
          </CardTitle>
          <CardDescription>Platform defaults apply to every school; your own categories are scoped to this school only.</CardDescription>
        </div>
        {isAdmin && (
          <Button className="gap-2" onClick={openCreate}>
            <Plus className="size-4" /> Add Category
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
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium text-foreground">{category.name}</TableCell>
                  <TableCell className="max-w-[320px] truncate text-muted-foreground">{category.description || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={category.is_global ? 'muted' : 'navy'}>{category.is_global ? 'Platform default' : 'This school'}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={category.status ? 'success' : 'muted'}>{category.status ? 'Enabled' : 'Disabled'}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {isAdmin && !category.is_global && (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleToggleStatus(category)}>
                          {category.status ? 'Disable' : 'Enable'}
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${category.name}`} onClick={() => openEdit(category)}>
                          <Edit3 className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label={`Delete ${category.name}`} className="text-destructive" onClick={() => setDeleting(category)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    )}
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
            <DialogTitle>{editing ? 'Edit Category' : 'Add Category'}</DialogTitle>
            <DialogDescription>Categories help group related compliance obligations for reporting and filtering.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label required>Name</Label>
              <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Fire & Safety" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Optional description" />
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
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.name ? `"${deleting.name}"` : 'This category'} will be removed. Compliance records already using it keep their existing value.
            </AlertDialogDescription>
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
