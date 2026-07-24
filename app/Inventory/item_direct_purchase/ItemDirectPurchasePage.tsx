"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LoaderCircle, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteInventory, loadInventory, saveInventory, type InventoryData, type InventoryRecord } from "../api";

type PurchaseRow = { categoryId: string; subCategoryId: string; itemId: string; quantity: string; price: string };
type Header = { vendorId: string; challanNo: string; challanDate: string; billNo: string; billDate: string; remarks: string };
const emptyRow = (): PurchaseRow => ({ categoryId: "", subCategoryId: "", itemId: "", quantity: "", price: "" });
const emptyHeader = (): Header => ({ vendorId: "", challanNo: "", challanDate: "", billNo: "", billDate: "", remarks: "" });
const emptyData: InventoryData = { records: [], options: {} };
const text = (record: InventoryRecord, key: string) => record.values[key] == null ? "" : String(record.values[key]);

export function ItemDirectPurchasePage() {
  const [data, setData] = useState(emptyData);
  const [header, setHeader] = useState<Header>(emptyHeader);
  const [rows, setRows] = useState<PurchaseRow[]>([emptyRow()]);
  const [editing, setEditing] = useState<InventoryRecord | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await loadInventory("direct-purchases", {})); }
    catch (reason: unknown) { setError(reason instanceof Error ? reason.message : "Direct purchases could not be loaded."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    // The authenticated ERP session is read after browser hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const setting = String(data.options.direct_purchase_settings?.[0]?.id || "");
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? data.records.filter((record) => Object.values(record.values).some((item) => String(item ?? "").toLowerCase().includes(query))) : data.records;
  }, [data.records, search]);

  function reset() { setHeader(emptyHeader()); setRows([emptyRow()]); setEditing(null); setShowForm(false); setError(""); }
  function startAdd() { reset(); setShowForm(true); }
  function startEdit(record: InventoryRecord) {
    setHeader({ vendorId: text(record, "vendor_id"), challanNo: text(record, "challan_no"), challanDate: text(record, "challan_date").slice(0, 10), billNo: text(record, "bill_no"), billDate: text(record, "bill_date").slice(0, 10), remarks: text(record, "remarks") });
    setRows([{ categoryId: text(record, "category_id"), subCategoryId: text(record, "sub_category_id"), itemId: text(record, "item_id"), quantity: text(record, "item_qty"), price: text(record, "price") }]);
    setEditing(record); setShowForm(true); setError("");
  }
  function updateHeader(patch: Partial<Header>) { setHeader((current) => ({ ...current, ...patch })); }
  function updateRow(index: number, patch: Partial<PurchaseRow>) { setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row)); }
  async function save() {
    if (!header.vendorId || !header.challanNo.trim() || !header.challanDate || !header.billNo.trim() || !header.billDate || !header.remarks.trim()) { setError("Vendor, challan, bill and remarks fields are required."); return; }
    if (rows.some((row) => !row.itemId || Number(row.quantity) <= 0 || Number(row.price) < 0 || row.price === "")) { setError("Item, quantity and price are required for every row."); return; }
    setBusy(true); setError("");
    try {
      setNotice(await saveInventory("direct-purchases", {
        vendor_id: header.vendorId, challan_no: header.challanNo, challan_date: header.challanDate,
        bill_no: header.billNo, bill_date: header.billDate, remarks: header.remarks,
        items: rows.map((row) => ({ category_id: row.categoryId || null, sub_category_id: row.subCategoryId || null, item_id: row.itemId, item_qty: row.quantity, price: row.price, amount: Number(row.quantity) * Number(row.price) })),
      }, editing?.id));
      reset(); await load();
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : "Direct purchase could not be saved."); }
    finally { setBusy(false); }
  }
  async function remove(record: InventoryRecord) {
    if (!window.confirm("Delete this direct purchase?")) return;
    setBusy(true);
    try { setNotice(await deleteInventory("direct-purchases", record.id)); await load(); }
    catch (reason: unknown) { setError(reason instanceof Error ? reason.message : "Direct purchase could not be deleted."); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen p-4 sm:p-6"><div className="mx-auto max-w-[1700px] space-y-5">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h1 className="text-2xl font-bold">Items Direct Purchase</h1><p className="mt-1 text-sm text-slate-500">Record items purchased directly from vendors.</p></div><Button onClick={startAdd}><Plus className="size-4" /> Add Items Direct Purchase</Button></div>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}
    {showForm && <Card><CardHeader className="border-b"><div className="flex items-center justify-between"><CardTitle>{editing ? "Edit Item Direct Purchase" : "Add Item Direct Purchase"}</CardTitle><Button variant="ghost" size="icon" onClick={reset}><X className="size-4" /></Button></div></CardHeader><CardContent>
      {!setting && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Inventory Master Setup is required before adding a direct purchase.</div>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div><Label>Vendor Name *</Label><select className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={header.vendorId} onChange={(event) => updateHeader({ vendorId: event.target.value })}><option value="">Select Vendor</option>{data.options.vendors?.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></div>
        <div><Label>Challan No. *</Label><Input className="mt-1" value={header.challanNo} onChange={(event) => updateHeader({ challanNo: event.target.value })} /></div>
        <div><Label>Challan Date *</Label><Input className="mt-1" type="date" value={header.challanDate} onChange={(event) => updateHeader({ challanDate: event.target.value })} /></div>
        <div><Label>Bill No. *</Label><Input className="mt-1" value={header.billNo} onChange={(event) => updateHeader({ billNo: event.target.value })} /></div>
        <div><Label>Bill Date *</Label><Input className="mt-1" type="date" value={header.billDate} onChange={(event) => updateHeader({ billDate: event.target.value })} /></div>
        <div><Label>Remarks *</Label><Textarea className="mt-1" rows={1} value={header.remarks} onChange={(event) => updateHeader({ remarks: event.target.value })} /></div>
      </div>
      <div className="mt-5 space-y-3">{rows.map((row, index) => <div key={index} className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-2 xl:grid-cols-7">
        {setting === "items_with_chain" && <><div><Label>Item Category</Label><select className="mt-1 h-10 w-full rounded-xl border px-2 text-sm" value={row.categoryId} onChange={(event) => updateRow(index, { categoryId: event.target.value, subCategoryId: "", itemId: "" })}><option value="">Select Category</option>{data.options.requisition_categories?.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></div>
          <div><Label>Item Sub Category</Label><select className="mt-1 h-10 w-full rounded-xl border px-2 text-sm" value={row.subCategoryId} onChange={(event) => updateRow(index, { subCategoryId: event.target.value, itemId: "" })}><option value="">Select Sub Category</option>{data.options.requisition_sub_categories?.filter((option) => option.parentId === Number(row.categoryId)).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></div></>}
        <div><Label>Item *</Label><select className="mt-1 h-10 w-full rounded-xl border px-2 text-sm" value={row.itemId} onChange={(event) => updateRow(index, { itemId: event.target.value })}><option value="">Select Item</option>{data.options.requisition_items?.filter((option) => setting !== "items_with_chain" || option.parentId === Number(row.subCategoryId)).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></div>
        <div><Label>Qty *</Label><Input className="mt-1" type="number" min={0.01} step="any" value={row.quantity} onChange={(event) => updateRow(index, { quantity: event.target.value })} /></div>
        <div><Label>Price *</Label><Input className="mt-1" type="number" min={0} step="any" value={row.price} onChange={(event) => updateRow(index, { price: event.target.value })} /></div>
        <div><Label>Amount</Label><Input className="mt-1" readOnly value={(Number(row.quantity || 0) * Number(row.price || 0)).toFixed(2)} /></div>
        {!editing && <div className="flex items-end"><Button type="button" variant="outline" onClick={() => rows.length === 1 ? setRows((current) => [...current, emptyRow()]) : setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}>{rows.length === 1 ? <Plus className="size-4" /> : <Trash2 className="size-4" />}{rows.length === 1 ? " Add Row" : " Remove"}</Button></div>}
      </div>)}</div>
      <div className="mt-5"><Button onClick={() => void save()} disabled={busy || !setting}>{busy && <LoaderCircle className="size-4 animate-spin" />} Save</Button></div>
    </CardContent></Card>}
    <Card><CardHeader className="border-b"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div className="relative w-full sm:max-w-md"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input className="pl-9" placeholder="Search direct purchases..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><Button variant="outline" onClick={() => void load()}><RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} /> Refresh</Button></div></CardHeader>
      <CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow>{["Sr.", "Vendor Name", "Category Name", "Sub Category Name", "Item Name", "Item Qty", "Item Price", "Total Amount", "Challan No.", "Challan Date", "Bill No.", "Bill Date", "Remarks", "Created By", "Created Date", "Action"].map((heading) => <TableHead key={heading} className="whitespace-nowrap">{heading}</TableHead>)}</TableRow></TableHeader><TableBody>
        {loading ? <TableRow><TableCell colSpan={16} className="h-32 text-center"><LoaderCircle className="mx-auto size-6 animate-spin" /></TableCell></TableRow> : filtered.length === 0 ? <TableRow><TableCell colSpan={16} className="h-32 text-center text-slate-500">No direct purchases found.</TableCell></TableRow> : filtered.map((record, index) => <TableRow key={record.id}><TableCell>{index + 1}</TableCell><TableCell>{text(record, "vendor_name")}</TableCell><TableCell>{text(record, "category_name")}</TableCell><TableCell>{text(record, "sub_category_name")}</TableCell><TableCell>{text(record, "item_name")}</TableCell><TableCell>{text(record, "item_qty")}</TableCell><TableCell>{text(record, "price")}</TableCell><TableCell>{text(record, "amount")}</TableCell><TableCell>{text(record, "challan_no")}</TableCell><TableCell>{text(record, "challan_date")}</TableCell><TableCell>{text(record, "bill_no")}</TableCell><TableCell>{text(record, "bill_date")}</TableCell><TableCell>{text(record, "remarks")}</TableCell><TableCell>{text(record, "created_by_name")}</TableCell><TableCell>{text(record, "created_on")}</TableCell><TableCell><div className="flex gap-1"><Button size="icon" variant="ghost" onClick={() => startEdit(record)}><Pencil className="size-4" /></Button><Button size="icon" variant="ghost" onClick={() => void remove(record)}><Trash2 className="size-4 text-red-600" /></Button></div></TableCell></TableRow>)}
      </TableBody></Table></div></CardContent>
    </Card>
  </div></main>;
}
