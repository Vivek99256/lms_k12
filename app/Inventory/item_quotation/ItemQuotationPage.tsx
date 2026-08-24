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

type QuotationRow = { itemId: string; quantity: string; unit: string; price: string; tax: string };
type Header = { vendorId: string; remarks: string; transportationCharge: string; installationCharge: string };
const emptyRow = (): QuotationRow => ({ itemId: "", quantity: "", unit: "", price: "", tax: "" });
const emptyHeader = (): Header => ({ vendorId: "", remarks: "", transportationCharge: "", installationCharge: "" });
const emptyData: InventoryData = { records: [], options: {} };
const text = (record: InventoryRecord, key: string) => record.values[key] == null ? "" : String(record.values[key]);

export function ItemQuotationPage() {
  const [data, setData] = useState(emptyData);
  const [header, setHeader] = useState<Header>(emptyHeader);
  const [rows, setRows] = useState<QuotationRow[]>([emptyRow()]);
  const [editing, setEditing] = useState<InventoryRecord | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await loadInventory("quotations", {})); }
    catch (reason: unknown) { setError(reason instanceof Error ? reason.message : "Quotations could not be loaded."); }
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

  function reset() { setHeader(emptyHeader()); setRows([emptyRow()]); setEditing(null); setShowForm(false); setError(""); }
  function startAdd() { reset(); setShowForm(true); }
  function startEdit(record: InventoryRecord) {
    setHeader({ vendorId: text(record, "vendor_id"), remarks: text(record, "remarks"), transportationCharge: text(record, "transportation_charge"), installationCharge: text(record, "installation_charge") });
    setRows([{ itemId: text(record, "item_id"), quantity: text(record, "qty"), unit: text(record, "unit"), price: text(record, "price"), tax: text(record, "tax") }]);
    setEditing(record); setShowForm(true); setError("");
  }
  function updateHeader(patch: Partial<Header>) { setHeader((current) => ({ ...current, ...patch })); }
  function updateRow(index: number, patch: Partial<QuotationRow>) { setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row)); }
  async function save() {
    if (!header.vendorId || !header.remarks.trim() || header.transportationCharge === "" || header.installationCharge === "") { setError("Vendor, remarks, transportation charge and installation charge are required."); return; }
    if (rows.some((row) => !row.itemId || Number(row.quantity) <= 0 || row.price === "" || Number(row.price) < 0 || !row.unit || row.tax === "" || Number(row.tax) < 0)) { setError("Item, quantity, unit, price and tax are required for every row."); return; }
    setBusy(true); setError("");
    try {
      setNotice(await saveInventory("quotations", {
        vendor_id: header.vendorId, remarks: header.remarks,
        transportation_charge: header.transportationCharge, installation_charge: header.installationCharge,
        items: rows.map((row) => ({ item_id: row.itemId, qty: row.quantity, unit: row.unit, price: row.price, tax: row.tax })),
      }, editing?.id));
      reset(); await load();
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : "Quotation could not be saved."); }
    finally { setBusy(false); }
  }
  async function remove(record: InventoryRecord) {
    if (!window.confirm("Delete this item quotation?")) return;
    setBusy(true);
    try { setNotice(await deleteInventory("quotations", record.id)); await load(); }
    catch (reason: unknown) { setError(reason instanceof Error ? reason.message : "Quotation could not be deleted."); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen p-4 sm:p-6"><div className="mx-auto max-w-[1700px] space-y-5">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h1 className="text-2xl font-bold">Item Quotation</h1><p className="mt-1 text-sm text-slate-500">Create and manage vendor item quotations.</p></div><Button onClick={startAdd}><Plus className="size-4" /> Add Item Quotation</Button></div>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}
    {showForm && <Card><CardHeader className="border-b"><div className="flex items-center justify-between"><CardTitle>{editing ? "Edit Item Quotation" : "Add Item Quotation"}</CardTitle><Button variant="ghost" size="icon" onClick={reset}><X className="size-4" /></Button></div></CardHeader><CardContent>
      <div className="grid gap-4 md:grid-cols-2"><div><Label>Vendor Name *</Label><select className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={header.vendorId} onChange={(event) => updateHeader({ vendorId: event.target.value })}><option value="">Select Vendor</option>{data.options.quotation_vendors?.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></div><div><Label>Remarks *</Label><Textarea className="mt-1" rows={2} value={header.remarks} onChange={(event) => updateHeader({ remarks: event.target.value })} /></div></div>
      <div className="mt-5 space-y-3">{rows.map((row, index) => <div key={index} className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-2 xl:grid-cols-6">
        <div><Label>Item *</Label><select className="mt-1 h-10 w-full rounded-xl border px-2 text-sm" value={row.itemId} onChange={(event) => updateRow(index, { itemId: event.target.value })}><option value="">Select Item</option>{data.options.quotation_items?.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></div>
        <div><Label>Qty *</Label><Input className="mt-1" type="number" min={0.01} step="any" value={row.quantity} onChange={(event) => updateRow(index, { quantity: event.target.value })} /></div>
        <div><Label>Unit *</Label><select className="mt-1 h-10 w-full rounded-xl border px-2 text-sm" value={row.unit} onChange={(event) => updateRow(index, { unit: event.target.value })}><option value="">Select Unit</option>{data.options.units?.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></div>
        <div><Label>Price/Piece *</Label><Input className="mt-1" type="number" min={0} step="any" value={row.price} onChange={(event) => updateRow(index, { price: event.target.value })} /></div>
        <div><Label>Tax *</Label><Input className="mt-1" type="number" min={0} step="any" value={row.tax} onChange={(event) => updateRow(index, { tax: event.target.value })} /></div>
        {!editing && <div className="flex items-end"><Button type="button" variant="outline" onClick={() => rows.length === 1 ? setRows((current) => [...current, emptyRow()]) : setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}>{rows.length === 1 ? <Plus className="size-4" /> : <Trash2 className="size-4" />}{rows.length === 1 ? " Add More" : " Remove"}</Button></div>}
      </div>)}</div>
      <div className="mt-5 grid gap-4 md:grid-cols-2"><div><Label>Transportation Charge *</Label><Input className="mt-1" type="number" min={0} value={header.transportationCharge} onChange={(event) => updateHeader({ transportationCharge: event.target.value })} /></div><div><Label>Installation Charge *</Label><Input className="mt-1" type="number" min={0} value={header.installationCharge} onChange={(event) => updateHeader({ installationCharge: event.target.value })} /></div></div>
      <div className="mt-5"><Button onClick={() => void save()} disabled={busy}>{busy && <LoaderCircle className="size-4 animate-spin" />} Save</Button></div>
    </CardContent></Card>}
    <Card><CardHeader className="border-b"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div className="relative w-full sm:max-w-md"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input className="pl-9" placeholder="Search item quotations..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><Button variant="outline" onClick={() => void load()}><RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} /> Refresh</Button></div></CardHeader>
      <CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow>{["Sr.", "Item", "Vendor Name", "Quantity", "Rate", "Unit", "Tax", "Total Price", "Remarks", "Transportation Charge", "Installation Charge", "Approval Status", "Approved Date", "Approved By", "Action"].map((heading) => <TableHead key={heading} className="whitespace-nowrap">{heading}</TableHead>)}</TableRow></TableHeader><TableBody>
        {loading ? <TableRow><TableCell colSpan={15} className="h-32 text-center"><LoaderCircle className="mx-auto size-6 animate-spin" /></TableCell></TableRow> : filtered.length === 0 ? <TableRow><TableCell colSpan={15} className="h-32 text-center text-slate-500">No quotations found.</TableCell></TableRow> : filtered.map((record, index) => <TableRow key={record.id}><TableCell>{index + 1}</TableCell><TableCell>{text(record, "item_name")}</TableCell><TableCell>{text(record, "vendor_name")}</TableCell><TableCell>{text(record, "qty")}</TableCell><TableCell>{text(record, "price")}</TableCell><TableCell>{text(record, "unit")}</TableCell><TableCell>{text(record, "tax")}</TableCell><TableCell>{text(record, "total")}</TableCell><TableCell>{text(record, "remarks")}</TableCell><TableCell>{text(record, "transportation_charge")}</TableCell><TableCell>{text(record, "installation_charge")}</TableCell><TableCell>{text(record, "approval_status")}</TableCell><TableCell>{text(record, "approved_date")}</TableCell><TableCell>{text(record, "approved_by_name")}</TableCell><TableCell><div className="flex gap-1"><Button size="icon" variant="ghost" onClick={() => startEdit(record)}><Pencil className="size-4" /></Button><Button size="icon" variant="ghost" onClick={() => void remove(record)}><Trash2 className="size-4 text-red-600" /></Button></div></TableCell></TableRow>)}
      </TableBody></Table></div></CardContent>
    </Card>
  </div></main>;
}
