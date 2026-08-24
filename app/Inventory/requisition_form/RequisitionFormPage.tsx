"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LoaderCircle, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteInventory, loadInventory, saveInventory, type InventoryData, type InventoryRecord } from "../api";

type ItemRow = { categoryId: string; subCategoryId: string; itemId: string; quantity: string; unit: string; expectedDelivery: string; remarks: string };
const emptyRow = (): ItemRow => ({ categoryId: "", subCategoryId: "", itemId: "", quantity: "", unit: "", expectedDelivery: "", remarks: "" });
const emptyData: InventoryData = { records: [], options: {} };
const value = (record: InventoryRecord, key: string) => record.values[key] == null ? "" : String(record.values[key]);
const now = () => {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

export function RequisitionFormPage() {
  const [data, setData] = useState(emptyData);
  const [requester, setRequester] = useState("");
  const [requisitionDate, setRequisitionDate] = useState(now);
  const [rows, setRows] = useState<ItemRow[]>([emptyRow()]);
  const [editing, setEditing] = useState<InventoryRecord | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await loadInventory("requisitions", {})); }
    catch (reason: unknown) { setError(reason instanceof Error ? reason.message : "Requisitions could not be loaded."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    // The authenticated ERP session is read after browser hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const setting = String(data.options.requisition_settings?.[0]?.id || "");
  const requisitionNumber = editing ? value(editing, "requisition_no") : String(data.options.requisition_numbers?.[0]?.id || "");
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? data.records.filter((record) => Object.values(record.values).some((item) => String(item ?? "").toLowerCase().includes(query))) : data.records;
  }, [data.records, search]);

  function reset() {
    setRequester(""); setRequisitionDate(now()); setRows([emptyRow()]); setEditing(null); setShowForm(false); setError("");
  }
  function startAdd() {
    reset();
    const available = data.options.requisition_users || [];
    setRequester(available.length === 1 ? String(available[0].id) : "");
    setShowForm(true);
  }
  function startEdit(record: InventoryRecord) {
    const selectedItem = data.options.requisition_items?.find((option) => String(option.id) === value(record, "item_id"));
    const subCategory = data.options.requisition_sub_categories?.find((option) => String(option.id) === String(selectedItem?.parentId || ""));
    setRequester(value(record, "requisition_by"));
    setRequisitionDate(value(record, "requisition_date").replace(" ", "T").slice(0, 16));
    setRows([{ categoryId: String(subCategory?.parentId || ""), subCategoryId: String(selectedItem?.parentId || ""), itemId: value(record, "item_id"), quantity: value(record, "item_qty"), unit: value(record, "item_unit"), expectedDelivery: value(record, "expected_delivery_time").replace(" ", "T").slice(0, 16), remarks: value(record, "remarks") }]);
    setEditing(record); setShowForm(true); setError("");
  }
  function updateRow(index: number, patch: Partial<ItemRow>) {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  }
  async function save() {
    if (!requester) { setError("Requisition By is required."); return; }
    const invalid = rows.find((row) => !row.itemId || !row.quantity || Number(row.quantity) < 1 || !row.unit || !row.remarks.trim());
    if (invalid) { setError("Item, quantity, unit and remarks are required for every row."); return; }
    setBusy(true); setError("");
    try {
      const payload = editing ? {
        item_id: rows[0].itemId, item_qty: rows[0].quantity, item_unit: rows[0].unit,
        expected_delivery_time: rows[0].expectedDelivery || null, remarks: rows[0].remarks,
      } : {
        requisition_by: requester, requisition_date: requisitionDate, requisition_no: requisitionNumber,
        items: rows.map((row) => ({ item_id: row.itemId, item_qty: row.quantity, item_unit: row.unit, expected_delivery_time: row.expectedDelivery || null, remarks: row.remarks })),
      };
      setNotice(await saveInventory("requisitions", payload, editing?.id));
      reset(); await load();
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : "Requisition could not be saved."); }
    finally { setBusy(false); }
  }
  async function remove(record: InventoryRecord) {
    if (!window.confirm("Delete this requisition?")) return;
    setBusy(true);
    try { setNotice(await deleteInventory("requisitions", record.id)); await load(); }
    catch (reason: unknown) { setError(reason instanceof Error ? reason.message : "Requisition could not be deleted."); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen p-4 sm:p-6"><div className="mx-auto max-w-[1600px] space-y-5">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h1 className="text-2xl font-bold">Requisition Form</h1><p className="mt-1 text-sm text-slate-500">Create and manage inventory requisitions.</p></div><Button onClick={startAdd}><Plus className="size-4" /> Add Requisition Form</Button></div>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}
    {showForm && <Card><CardHeader className="border-b"><div className="flex items-center justify-between"><CardTitle>{editing ? "Edit Requisition" : "Add Requisition"}</CardTitle><Button variant="ghost" size="icon" onClick={reset}><X className="size-4" /></Button></div></CardHeader><CardContent>
      {!setting && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Please add Master setup for add requisition.</div>}
      <div className="grid gap-4 md:grid-cols-3"><div><Label>Requisition By *</Label><select className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={requester} disabled={Boolean(editing)} onChange={(event) => setRequester(event.target.value)}><option value="">Select Requisition By</option>{data.options.requisition_users?.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></div>
        <div><Label>Requisition Date</Label><Input className="mt-1" type="datetime-local" value={requisitionDate} readOnly /></div><div><Label>Requisition No.</Label><Input className="mt-1" value={requisitionNumber} readOnly /></div></div>
      <div className="mt-5 space-y-3">{rows.map((row, index) => <div key={index} className="grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-2 xl:grid-cols-8">
        {setting === "items_with_chain" && <><div><Label>Item Category *</Label><select className="mt-1 h-10 w-full rounded-xl border px-2 text-sm" value={row.categoryId} onChange={(event) => updateRow(index, { categoryId: event.target.value, subCategoryId: "", itemId: "" })}><option value="">Select Category</option>{data.options.requisition_categories?.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></div>
          <div><Label>Item Sub Category *</Label><select className="mt-1 h-10 w-full rounded-xl border px-2 text-sm" value={row.subCategoryId} onChange={(event) => updateRow(index, { subCategoryId: event.target.value, itemId: "" })}><option value="">Select Sub Category</option>{data.options.requisition_sub_categories?.filter((option) => option.parentId === Number(row.categoryId)).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></div></>}
        <div><Label>Item *</Label><select className="mt-1 h-10 w-full rounded-xl border px-2 text-sm" value={row.itemId} onChange={(event) => updateRow(index, { itemId: event.target.value })}><option value="">Select Item</option>{data.options.requisition_items?.filter((option) => setting !== "items_with_chain" || option.parentId === Number(row.subCategoryId)).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></div>
        <div><Label>Qty *</Label><Input className="mt-1" type="number" min={1} value={row.quantity} onChange={(event) => updateRow(index, { quantity: event.target.value })} /></div>
        <div><Label>Unit *</Label><select className="mt-1 h-10 w-full rounded-xl border px-2 text-sm" value={row.unit} onChange={(event) => updateRow(index, { unit: event.target.value })}><option value="">Select Unit</option>{data.options.units?.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></div>
        <div><Label>Expected Delivery</Label><Input className="mt-1" type="datetime-local" value={row.expectedDelivery} onChange={(event) => updateRow(index, { expectedDelivery: event.target.value })} /></div>
        <div><Label>Remarks *</Label><Input className="mt-1" value={row.remarks} onChange={(event) => updateRow(index, { remarks: event.target.value })} /></div>
        {!editing && <div className="flex items-end"><Button type="button" variant="outline" onClick={() => rows.length === 1 ? setRows((current) => [...current, emptyRow()]) : setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}>{rows.length === 1 ? <Plus className="size-4" /> : <Trash2 className="size-4" />}{rows.length === 1 ? " Add Row" : " Remove"}</Button></div>}
      </div>)}</div>
      <div className="mt-5"><Button onClick={() => void save()} disabled={busy || !setting}>{busy && <LoaderCircle className="size-4 animate-spin" />} Save</Button></div>
    </CardContent></Card>}
    <Card><CardHeader className="border-b"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div className="relative w-full sm:max-w-md"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input className="pl-9" placeholder="Search requisitions..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><Button variant="outline" onClick={() => void load()}><RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} /> Refresh</Button></div></CardHeader>
      <CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow>{["Sr.", "Requisition By", "Requisition Date", "Requisition No.", "Item", "Item Qty", "Unit", "Expected Delivery Time", "Remarks", "Status", "Approved By", "Approval Remarks", "Approval Date", "Action"].map((heading) => <TableHead key={heading} className="whitespace-nowrap">{heading}</TableHead>)}</TableRow></TableHeader><TableBody>
        {loading ? <TableRow><TableCell colSpan={14} className="h-32 text-center"><LoaderCircle className="mx-auto size-6 animate-spin" /></TableCell></TableRow> : filtered.length === 0 ? <TableRow><TableCell colSpan={14} className="h-32 text-center text-slate-500">No requisitions found.</TableCell></TableRow> : filtered.map((record, index) => <TableRow key={record.id}><TableCell>{index + 1}</TableCell><TableCell>{value(record, "requisition_by_name")}</TableCell><TableCell>{value(record, "requisition_date")}</TableCell><TableCell>{value(record, "requisition_no")}</TableCell><TableCell>{value(record, "item_name")}</TableCell><TableCell>{value(record, "item_qty")}</TableCell><TableCell>{value(record, "item_unit")}</TableCell><TableCell>{value(record, "expected_delivery_time")}</TableCell><TableCell>{value(record, "remarks")}</TableCell><TableCell>{value(record, "status")}</TableCell><TableCell>{value(record, "requisition_approved_by")}</TableCell><TableCell>{value(record, "requisition_approved_remarks")}</TableCell><TableCell>{value(record, "requisition_approved_date")}</TableCell><TableCell><div className="flex gap-1"><Button size="icon" variant="ghost" onClick={() => startEdit(record)}><Pencil className="size-4" /></Button><Button size="icon" variant="ghost" onClick={() => void remove(record)}><Trash2 className="size-4 text-red-600" /></Button></div></TableCell></TableRow>)}
      </TableBody></Table></div></CardContent>
    </Card>
  </div></main>;
}
