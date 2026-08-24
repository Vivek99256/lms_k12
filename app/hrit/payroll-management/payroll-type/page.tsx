'use client'

/**
 * Ported from G2G's
 * `components/domain/hrms/hrit/payroll-management/payroll-type/page.tsx`.
 *
 * Every tab, KPI card and row action is driven by the same three Laravel
 * endpoints - GET /payroll-type, POST /payroll-type/store and
 * POST /payroll-type/destroy/{id} (App\Http\Controllers\Payroll\PayrollController).
 * The list returns active and inactive rows for the tenant, so the tabs and the
 * counters are slices of one response rather than separate requests.
 *
 * Adaptation: G2G hand-rolls its own admin/hr gate and page header inline
 * instead of using its own `PayrollPageShell` (the other five payroll screens
 * do use it). Per this migration's convention every payroll page is wrapped in
 * the ported `PayrollPageShell`, so the inline gate/header here were replaced
 * by it - the header text, KPI cards, tabs, table and dialogs are otherwise
 * unchanged.
 */

import { useMemo, useState } from 'react'
import { ArrowDownCircle, ArrowUpCircle, CheckCircle2, Plus, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog'
import { KPICard } from '@/app/hrit/_components/kpi-card'
import { Tabs } from '@/app/hrit/_components/tabs'
import {
  PayrollMessages,
  PayrollPageShell,
  PayrollTableSkeleton,
} from '@/app/hrit/_components/payroll-shell'
import { usePayrollTypes } from '@/app/hrit/_lib/use-payroll'
import type { PayrollTypeRow } from '@/app/hrit/_lib/payroll-api'
import { PayrollTypeDialog, PayrollTypeTable } from './components'

type PayrollTab = 'all' | 'earnings' | 'deductions'

export default function PayrollTypePage() {
  const {
    loading,
    processing,
    error,
    actionMessage,
    payrollTypes,
    summary,
    retry,
    clearMessages,
    save,
    toggleStatus,
    remove,
  } = usePayrollTypes()

  const [activeTab, setActiveTab] = useState<PayrollTab>('all')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editing, setEditing] = useState<PayrollTypeRow | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PayrollTypeRow | null>(null)

  const tabs = useMemo(
    () => [
      { id: 'all', label: `All (${summary.total})` },
      { id: 'earnings', label: `Earnings (${summary.earnings})` },
      { id: 'deductions', label: `Deductions (${summary.deductions})` },
    ],
    [summary],
  )

  const visibleRows = useMemo(() => {
    if (activeTab === 'earnings') return payrollTypes.filter((row) => row.kind === 'Earning')
    if (activeTab === 'deductions') return payrollTypes.filter((row) => row.kind === 'Deduction')
    return payrollTypes
  }, [activeTab, payrollTypes])

  const openCreate = () => {
    setEditing(null)
    setIsDialogOpen(true)
  }

  const openEdit = (row: PayrollTypeRow) => {
    setEditing(row)
    setIsDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!pendingDelete) return
    const result = await remove(pendingDelete.id)
    if (result.ok) {
      setPendingDelete(null)
    }
  }

  const payrollTypeDialog = (
    <PayrollTypeDialog
      open={isDialogOpen}
      onOpenChange={setIsDialogOpen}
      editing={editing}
      processing={processing}
      onSave={save}
    />
  )

  const actions = (
    <Button className="h-9 w-full gap-2 rounded-lg font-semibold md:w-auto" onClick={openCreate}>
      <Plus className="size-4" />
      Add Payroll Type
    </Button>
  )

  return (
    <PayrollPageShell
      title="Payroll Type"
      description="Manage the earning and deduction components used to build salary structures and monthly payroll."
      actions={actions}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Total Types"
          value={loading ? '-' : summary.total}
          description="Components configured for this organization"
          icon={<Wallet className="size-5" />}
        />
        <KPICard
          label="Active Types"
          value={loading ? '-' : summary.active}
          variant="success"
          description={loading ? undefined : `${summary.inactive} inactive`}
          icon={<CheckCircle2 className="size-5" />}
        />
        <KPICard
          label="Earnings"
          value={loading ? '-' : summary.earnings}
          variant="primary"
          description="Added to gross salary"
          icon={<ArrowUpCircle className="size-5" />}
        />
        <KPICard
          label="Deductions"
          value={loading ? '-' : summary.deductions}
          variant="warning"
          description="Subtracted from gross salary"
          icon={<ArrowDownCircle className="size-5" />}
        />
      </div>

      <Tabs tabs={tabs} active={activeTab} onChange={(id) => setActiveTab(id as PayrollTab)} />

      {loading ? (
        <PayrollTableSkeleton />
      ) : error && payrollTypes.length === 0 ? (
        <ErrorState title="Unable to load payroll types" description={error} retry={retry} />
      ) : payrollTypes.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<Wallet className="size-10" />}
              title="No payroll types configured"
              description="Add your first earning or deduction component to start building salary structures."
              action={
                <Button onClick={openCreate}>
                  <Plus className="mr-2 size-4" />
                  Add Payroll Type
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg md:text-xl">
              {activeTab === 'earnings'
                ? 'Earning Components'
                : activeTab === 'deductions'
                  ? 'Deduction Components'
                  : 'All Payroll Types'}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {visibleRows.length} {visibleRows.length === 1 ? 'component' : 'components'} in this
              view
            </CardDescription>
          </CardHeader>

          {(actionMessage || error) && (
            <CardContent className="pt-0">
              <PayrollMessages error={error} actionMessage={actionMessage} onDismiss={clearMessages} />
            </CardContent>
          )}

          <CardContent>
            <PayrollTypeTable
              rows={visibleRows}
              processing={processing}
              onEdit={openEdit}
              onToggleStatus={toggleStatus}
              onDelete={setPendingDelete}
            />
          </CardContent>
        </Card>
      )}

      {payrollTypeDialog}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
      >
        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payroll Type</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `"${pendingDelete.name || 'This payroll type'}" will be removed from the payroll component list. Salary structures already built with it keep their saved values.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setPendingDelete(null)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="w-full sm:w-auto"
              onClick={handleDelete}
              disabled={processing}
            >
              {processing ? 'Deleting...' : 'Delete'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PayrollPageShell>
  )
}
