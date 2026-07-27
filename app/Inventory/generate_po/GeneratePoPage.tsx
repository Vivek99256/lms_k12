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

type PoRow = { itemId: string; itemName: string; selected: boolean; price: string; quantity: string; discount: string; tax: string };
type Header = { vendorId: string; deliveryTime: string; deliveryPlace: string; paymentTerms: string; remarks: string; transportation: string; installation: string };
const emptyHeader = (): Header => ({ vendorId: "", deliveryTime: "", deliveryPlace: "", paymentTerms: "", remarks: "", transportation: "", installation: "" });
const emptyData: InventoryData = { records: [], options: {} };
const text = (record: InventoryRecord, key: string) => record.values[key] == null ? "" : String(record.values[key]);
const amounts = (row: PoRow) => {
  const amount = Number(row.price || 0) * Number(row.quantity || 0);
  const discountAmount = amount * Number(row.discount || 0) / 100;
  const afterDiscount = amount - discountAmount;
  const taxAmount = afterDiscount * Number(row.tax || 0) / 100;
  return { amount, discountAmount, afterDiscount, taxAmount, afterTax: afterDiscount + taxAmount };
};

export function GeneratePoPage() {
  const [data, setData] = useState(emptyData);
  const [header, setHeader] = useState<Header>(emptyHeader);
  const [rows, setRows] = useState<PoRow[]>([]);
  const [editing, setEditing] = useState<InventoryRecord | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await loadInventory("purchase-orders", {})); }
    catch (reason: unknown) { setError(reason instanceof Error ? reason.message : "Purchase orders could not be loaded."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    // The authenticated ERP session is available after browser hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  const poNumber = editing ? text(editing, "po_number") : String(data.options.po_numbers?.[0]?.id || "");
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? data.records.filter((record) => Object.values(record.values).some((item) => String(item ?? "").toLowerCase().includes(query))) : data.records;
  }, [data.records, search]);

  function reset() { setHeader(emptyHeader()); setRows([]); setEditing(null); setShowForm(false); setError(""); }
  function selectVendor(vendorId: string) {
    setHeader((current) => ({ ...current, vendorId }));
    setRows((data.options.po_quotation_items || []).filter((option) => option.parentId === Number(vendorId)).map((option) => ({ itemId: String(option.id), itemName: option.label, selected: true, price: String(option.price ?? 0), quantity: "1", discount: "0", tax: "0" })));
  }
  function startAdd() { reset(); setShowForm(true); }
  function startEdit(record: InventoryRecord) {
    setHeader({ vendorId: text(record, "vendor_id"), deliveryTime: text(record, "delivery_time").replace(" ", "T").slice(0, 16), deliveryPlace: text(record, "po_place_of_delivery"), paymentTerms: text(record, "payment_terms"), remarks: text(record, "remarks"), transportation: text(record, "transportation_charge"), installation: text(record, "installation_charge") });
    setRows([{ itemId: text(record, "item_id"), itemName: text(record, "item_name"), selected: true, price: text(record, "price"), quantity: text(record, "qty"), discount: text(record, "dis_per") || "0", tax: text(record, "tax_per") || "0" }]);
    setEditing(record); setShowForm(true); setError("");
  }
  function updateHeader(patch: Partial<Header>) { setHeader((current) => ({ ...current, ...patch })); }
  function updateRow(index: number, patch: Partial<PoRow>) { setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row)); }
  async function save() {
    const selected = rows.filter((row) => row.selected);
    if (!header.vendorId || !header.deliveryPlace.trim() || !header.paymentTerms.trim() || !header.remarks.trim() || header.transportation === "" || header.installation === "") { setError("Vendor, delivery place, payment terms, remarks and charges are required."); return; }
    if (selected.length === 0) { setError("Select at least one quoted item."); return; }
    if (selected.some((row) => Number(row.quantity) <= 0 || Number(row.price) < 0 || Number(row.discount) < 0 || Number(row.tax) < 0)) { setError("Selected item calculations contain invalid values."); return; }
    setBusy(true); setError("");
    try {
      setNotice(await saveInventory("purchase-orders", {
        po_number: poNumber, vendor_id: header.vendorId, delivery_time: header.deliveryTime || null,
        po_place_of_delivery: header.deliveryPlace, payment_terms: header.paymentTerms, remarks: header.remarks,
        transportation_charge: header.transportation, installation_charge: header.installation,
        items: selected.map((row) => ({ item_id: row.itemId, price: row.price, qty: row.quantity, dis_per: row.discount, tax_per: row.tax })),
      }, editing?.id));
      reset(); await load();
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : "Purchase order could not be saved."); }
    finally { setBusy(false); }
  }
  async function remove(record: InventoryRecord) {
    if (!window.confirm("Delete this PO item?")) return;
    setBusy(true);
    try { setNotice(await deleteInventory("purchase-orders", record.id)); await load(); }
    catch (reason: unknown) { setError(reason instanceof Error ? reason.message : "Purchase order could not be deleted."); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen p-4 sm:p-6"><div className="mx-auto max-w-[1900px] space-y-5">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h1 className="text-2xl font-bold">Generate PO</h1><p className="mt-1 text-sm text-slate-500">Generate purchase orders from vendor quotation items.</p></div><Button onClick={startAdd}><Plus className="size-4" /> Generate PO</Button></div>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}
    {showForm && <Card><CardHeader className="border-b"><div className="flex items-center justify-between"><CardTitle>{editing ? "Edit PO" : "Generate PO"}</CardTitle><Button variant="ghost" size="icon" onClick={reset}><X className="size-4" /></Button></div></CardHeader><CardContent>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"><div><Label>PO No.</Label><Input className="mt-1" value={poNumber} readOnly /></div><div><Label>Vendor Name *</Label><select className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={header.vendorId} disabled={Boolean(editing)} onChange={(event) => selectVendor(event.target.value)}><option value="">Select Vendor</option>{data.options.po_vendors?.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></div><div><Label>Delivery DateTime</Label><Input className="mt-1" type="datetime-local" value={header.deliveryTime} onChange={(event) => updateHeader({ deliveryTime: event.target.value })} /></div><div><Label>Place of Delivery *</Label><Textarea className="mt-1" rows={2} value={header.deliveryPlace} onChange={(event) => updateHeader({ deliveryPlace: event.target.value })} /></div><div><Label>Payment Terms *</Label><Textarea className="mt-1" rows={2} value={header.paymentTerms} onChange={(event) => updateHeader({ paymentTerms: event.target.value })} /></div><div><Label>Remarks *</Label><Textarea className="mt-1" rows={2} value={header.remarks} onChange={(event) => updateHeader({ remarks: event.target.value })} /></div><div><Label>Transportation Charge *</Label><Input className="mt-1" type="number" min={0} value={header.transportation} onChange={(event) => updateHeader({ transportation: event.target.value })} /></div><div><Label>Installation Charge *</Label><Input className="mt-1" type="number" min={0} value={header.installation} onChange={(event) => updateHeader({ installation: event.target.value })} /></div></div>
      <div className="mt-5 overflow-x-auto rounded-xl border"><Table><TableHeader><TableRow><TableHead><input aria-label="Select all items" type="checkbox" checked={rows.length > 0 && rows.every((row) => row.selected)} onChange={(event) => setRows((current) => current.map((row) => ({ ...row, selected: event.target.checked })))} /></TableHead>{["Item", "Rate", "Qty", "Amount", "Discount %", "Discount Amount", "After Discount", "Tax %", "Tax Amount", "Total"].map((heading) => <TableHead key={heading} className="whitespace-nowrap">{heading}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.length === 0 ? <TableRow><TableCell colSpan={11} className="h-24 text-center text-slate-500">Select a vendor to load quotation items.</TableCell></TableRow> : rows.map((row, index) => { const calculated = amounts(row); return <TableRow key={`${row.itemId}-${index}`}><TableCell><input type="checkbox" checked={row.selected} onChange={(event) => updateRow(index, { selected: event.target.checked })} /></TableCell><TableCell>{row.itemName}</TableCell><TableCell>{row.price}</TableCell><TableCell><Input className="min-w-20" type="number" min={0.01} value={row.quantity} onChange={(event) => updateRow(index, { quantity: event.target.value })} /></TableCell><TableCell>{calculated.amount.toFixed(2)}</TableCell><TableCell><Input className="min-w-20" type="number" min={0} value={row.discount} onChange={(event) => updateRow(index, { discount: event.target.value })} /></TableCell><TableCell>{calculated.discountAmount.toFixed(2)}</TableCell><TableCell>{calculated.afterDiscount.toFixed(2)}</TableCell><TableCell><Input className="min-w-20" type="number" min={0} value={row.tax} onChange={(event) => updateRow(index, { tax: event.target.value })} /></TableCell><TableCell>{calculated.taxAmount.toFixed(2)}</TableCell><TableCell>{calculated.afterTax.toFixed(2)}</TableCell></TableRow>; })}</TableBody></Table></div>
      <div className="mt-5"><Button onClick={() => void save()} disabled={busy}>{busy && <LoaderCircle className="size-4 animate-spin" />} Save</Button></div>
    </CardContent></Card>}
    <Card><CardHeader className="border-b"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div className="relative w-full sm:max-w-md"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input className="pl-9" placeholder="Search purchase orders..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><Button variant="outline" onClick={() => void load()}><RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} /> Refresh</Button></div></CardHeader>
      <CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow>{["Sr.", "PO No.", "Item", "Vendor", "Firm Name", "Price", "Qty", "Amount", "Discount %", "Discount Amount", "After Discount", "Tax %", "Tax Amount", "After Tax", "Grand Total", "Transport", "Installation", "Payment Terms", "Remarks", "Delivery Time", "Approval Status", "Approval Remarks", "Approved Date", "Approved By", "Action"].map((heading) => <TableHead key={heading} className="whitespace-nowrap">{heading}</TableHead>)}</TableRow></TableHeader><TableBody>
        {loading ? <TableRow><TableCell colSpan={25} className="h-32 text-center"><LoaderCircle className="mx-auto size-6 animate-spin" /></TableCell></TableRow> : filtered.length === 0 ? <TableRow><TableCell colSpan={25} className="h-32 text-center text-slate-500">No purchase orders found.</TableCell></TableRow> : filtered.map((record, index) => <TableRow key={record.id}><TableCell>{index + 1}</TableCell>{["po_number", "item_name", "vendor_name", "company_name", "price", "qty", "amount", "dis_per", "dis_amount_value", "after_dis_amount", "tax_per", "tax_amount_value", "after_tax_amount", "after_tax_amount", "transportation_charge", "installation_charge", "payment_terms", "remarks", "delivery_time", "po_approval_status", "po_approval_remark", "po_approved_date", "po_approved_by"].map((key, fieldIndex) => <TableCell key={`${key}-${fieldIndex}`}>{text(record, key)}</TableCell>)}<TableCell><div className="flex gap-1"><Button size="icon" variant="ghost" onClick={() => startEdit(record)}><Pencil className="size-4" /></Button><Button size="icon" variant="ghost" onClick={() => void remove(record)}><Trash2 className="size-4 text-red-600" /></Button></div></TableCell></TableRow>)}
      </TableBody></Table></div></CardContent>
    </Card>
  </div></main>;
}
