"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LoaderCircle, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { loadInventory, saveInventory, type InventoryData, type InventoryRecord } from "../api";

type ApprovalValue = { approvedQty: string; status: string; remarks: string };
const emptyData: InventoryData = { records: [], options: {} };
const text = (record: InventoryRecord, key: string) => record.values[key] == null ? "" : String(record.values[key]);

export function RequisitionApprovalPage() {
  const [data, setData] = useState(emptyData);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [values, setValues] = useState<Record<number, ApprovalValue>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await loadInventory("requisition-approvals", {});
      setData(response);
      setValues(Object.fromEntries(response.records.map((record) => [record.id, {
        approvedQty: text(record, "approved_qty"), status: text(record, "requisition_status"),
        remarks: text(record, "requisition_approved_remarks"),
      }])));
      setSelected(new Set());
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : "Requisitions could not be loaded."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    // The authenticated ERP session is available after browser hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? data.records.filter((record) => Object.values(record.values).some((item) => String(item ?? "").toLowerCase().includes(query))) : data.records;
  }, [data.records, search]);
  const selectable = filtered.filter((record) => Number(record.values.opening_stock || 0) !== 0);
  const allChecked = selectable.length > 0 && selectable.every((record) => selected.has(record.id));

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(selectable.map((record) => record.id)) : new Set());
  }
  function toggle(id: number, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }
  function update(id: number, patch: Partial<ApprovalValue>) {
    setValues((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  }
  async function save() {
    if (selected.size === 0) { setError("Please select minimum one requisition for approval."); return; }
    setBusy(true); setError("");
    try {
      const approvals = [...selected].map((id) => ({
        id, approved_qty: values[id]?.approvedQty || null, requisition_status: values[id]?.status || null,
        requisition_approved_remarks: values[id]?.remarks || null,
      }));
      setNotice(await saveInventory("requisition-approvals", { approvals }));
      await load();
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : "Requisitions could not be approved."); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen p-4 sm:p-6"><div className="mx-auto max-w-[1700px] space-y-5">
    <div><h1 className="text-2xl font-bold">Requisition Form Approval</h1><p className="mt-1 text-sm text-slate-500">Review and approve inventory requisitions.</p></div>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}
    <Card><CardHeader className="border-b"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div className="relative w-full sm:max-w-md"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input className="pl-9" placeholder="Search requisitions..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><Button variant="outline" onClick={() => void load()}><RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} /> Refresh</Button></div></CardHeader>
      <CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow>
        <TableHead><input aria-label="Select all requisitions" type="checkbox" checked={allChecked} onChange={(event) => toggleAll(event.target.checked)} /></TableHead>
        {["Requisition By", "Requisition Date", "Requisition No.", "Item", "Opening Stock", "Item Qty", "Approved Qty", "Expected Delivery Time", "Remarks", "Requisition Status", "Requisition Approved By", "Approved Remarks", "Items Direct Purchase"].map((heading) => <TableHead key={heading} className="whitespace-nowrap">{heading}</TableHead>)}
      </TableRow></TableHeader><TableBody>
        {loading ? <TableRow><TableCell colSpan={14} className="h-32 text-center"><LoaderCircle className="mx-auto size-6 animate-spin" /></TableCell></TableRow> : filtered.length === 0 ? <TableRow><TableCell colSpan={14} className="h-32 text-center text-slate-500">No requisitions found.</TableCell></TableRow> : filtered.map((record) => {
          const disabled = Number(record.values.opening_stock || 0) === 0;
          const row = values[record.id] || { approvedQty: "", status: "", remarks: "" };
          return <TableRow key={record.id}>
            <TableCell><input aria-label={`Select requisition ${text(record, "requisition_no")}`} type="checkbox" disabled={disabled} checked={selected.has(record.id)} onChange={(event) => toggle(record.id, event.target.checked)} /></TableCell>
            <TableCell>{text(record, "requisition_by_name")}</TableCell><TableCell>{text(record, "requisition_date")}</TableCell><TableCell>{text(record, "requisition_no")}</TableCell><TableCell>{text(record, "item_name")}</TableCell><TableCell>{text(record, "opening_stock")}</TableCell><TableCell>{text(record, "item_qty")}</TableCell>
            <TableCell><Input className="min-w-24" type="number" disabled={disabled} value={row.approvedQty} onChange={(event) => update(record.id, { approvedQty: event.target.value })} /></TableCell>
            <TableCell>{text(record, "expected_delivery_time")}</TableCell><TableCell>{text(record, "remarks")}</TableCell>
            <TableCell><select className="h-10 min-w-36 rounded-xl border border-slate-200 bg-white px-2 text-sm" disabled={disabled} value={row.status} onChange={(event) => update(record.id, { status: event.target.value })}><option value="">Select</option>{data.options.statuses?.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}</select></TableCell>
            <TableCell>{text(record, "requisition_approved_by")}</TableCell>
            <TableCell><Textarea className="min-w-48" rows={2} disabled={disabled} value={row.remarks} onChange={(event) => update(record.id, { remarks: event.target.value })} /></TableCell>
            <TableCell><a href="/Inventory/item_direct_purchase" target="_blank" rel="noreferrer"><Button type="button" variant="outline">Direct Purchase</Button></a></TableCell>
          </TableRow>;
        })}
      </TableBody></Table></div><div className="border-t p-4 text-center"><Button onClick={() => void save()} disabled={busy}>{busy && <LoaderCircle className="size-4 animate-spin" />} Save</Button></div></CardContent>
    </Card>
  </div></main>;
}
