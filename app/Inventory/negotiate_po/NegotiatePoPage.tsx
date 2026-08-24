"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LoaderCircle, Plus, RefreshCw, Search, X, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  deleteInventory,
  loadInventory,
  saveInventory,
  type InventoryData,
  type InventoryRecord,
} from "../api";

type PoRow = {
  itemId: string;
  itemName: string;
  selected: boolean;
  price: string;
  quantity: string;
  discount: string;
  tax: string;
};

type Header = {
  poNumber: string;
  vendorId: string;
  vendorName: string;
  deliveryTime: string;
  deliveryPlace: string;
  paymentTerms: string;
  remarks: string;
  transportation: string;
  installation: string;
  approvalStatus: string;
  approvalRemark: string;
};

const emptyHeader = (): Header => ({
  poNumber: "",
  vendorId: "",
  vendorName: "",
  deliveryTime: "",
  deliveryPlace: "",
  paymentTerms: "",
  remarks: "",
  transportation: "",
  installation: "",
  approvalStatus: "",
  approvalRemark: "",
});

const text = (record: InventoryRecord, key: string) =>
  record.values[key] == null ? "" : String(record.values[key]);

const amounts = (row: PoRow) => {
  const amount = Number(row.price || 0) * Number(row.quantity || 0);
  const discountAmount = amount * Number(row.discount || 0) / 100;
  const afterDiscount = amount - discountAmount;
  const taxAmount = afterDiscount * Number(row.tax || 0) / 100;
  return {
    amount,
    discountAmount,
    afterDiscount,
    taxAmount,
    afterTax: afterDiscount + taxAmount,
  };
};

export default function NegotiatePoPage() {
  const [data, setData] = useState<InventoryData>({ records: [], options: {} });
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
    setLoading(true);
    setError("");
    try {
      setData(await loadInventory("purchase-order-negotiations", {}));
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Negotiate PO data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? data.records.filter((record) =>
          Object.values(record.values).some((item) =>
            String(item ?? "").toLowerCase().includes(query)
          )
        )
      : data.records;
  }, [data.records, search]);

  function reset() {
    setHeader(emptyHeader());
    setRows([]);
    setEditing(null);
    setShowForm(false);
    setError("");
    setNotice("");
  }

  function startAdd() {
    reset();
    setShowForm(true);
  }

  function startEdit(record: InventoryRecord) {
    const poNumber = text(record, "po_number");
    const samePo = data.records.filter((r) => text(r, "po_number") === poNumber);
    const first = samePo[0] || record;
    setHeader({
      poNumber,
      vendorId: text(first, "vendor_id"),
      vendorName: text(first, "vendor_name"),
      deliveryTime: text(first, "delivery_time"),
      deliveryPlace: text(first, "po_place_of_delivery"),
      paymentTerms: text(first, "payment_terms"),
      remarks: text(first, "remarks"),
      transportation: text(first, "transportation_charge"),
      installation: text(first, "installation_charge"),
      approvalStatus: text(first, "po_approval_status"),
      approvalRemark: text(first, "po_approval_remark"),
    });
    setRows(
      samePo.map((r) => ({
        itemId: text(r, "item_id"),
        itemName: text(r, "item_name"),
        selected: true,
        price: text(r, "price"),
        quantity: text(r, "qty"),
        discount: text(r, "dis_per") || "0",
        tax: text(r, "tax_per") || "0",
      }))
    );
    setEditing(first);
    setShowForm(true);
    setError("");
    setNotice("");
  }

  function updateHeader(patch: Partial<Header>) {
    setHeader((current) => ({ ...current, ...patch }));
  }

  function updateRow(index: number, patch: Partial<PoRow>) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  async function save() {
    if (!header.poNumber) {
      setError("PO Number is required.");
      return;
    }
    if (!header.approvalStatus) {
      setError("Approval Status is required.");
      return;
    }
    const selected = rows.filter((row) => row.selected);
    if (selected.length === 0) {
      setError("Select at least one item.");
      return;
    }
    if (
      selected.some(
        (row) =>
          Number(row.quantity) <= 0 ||
          Number(row.price) < 0 ||
          Number(row.discount) < 0 ||
          Number(row.tax) < 0
      )
    ) {
      setError("Selected item calculations contain invalid values.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const payload = {
        po_number: header.poNumber,
        vendor_id: header.vendorId,
        transportation_charge: header.transportation,
        installation_charge: header.installation,
        delivery_time: header.deliveryTime || null,
        po_place_of_delivery: header.deliveryPlace,
        payment_terms: header.paymentTerms,
        remarks: header.remarks,
        items: selected.map((row) => ({
          item_id: row.itemId,
          price: row.price,
          qty: row.quantity,
          dis_per: row.discount,
          tax_per: row.tax,
        })),
        po_approval_status: header.approvalStatus,
        po_approval_remark: header.approvalRemark,
      };

      await saveInventory("purchase-order-negotiations", payload, editing?.id);
      reset();
      await load();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Negotiate PO could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(record: InventoryRecord) {
    if (!window.confirm("Delete this negotiation?")) return;
    setBusy(true);
    try {
      await deleteInventory("purchase-order-negotiations", record.id);
      await load();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Negotiate PO could not be deleted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <div className="mx-auto max-w-[1900px] space-y-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold">Negotiate PO</h1>
            <p className="mt-1 text-sm text-slate-500">Negotiate purchase order pricing and approvals.</p>
          </div>
          <Button onClick={startAdd}>
            <Plus className="size-4" /> Negotiate PO
          </Button>
        </div>
        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {notice && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {notice}
          </div>
        )}
        {showForm && (
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle>{editing ? "Edit Negotiate PO" : "Negotiate PO"}</CardTitle>
                <Button variant="ghost" size="icon" onClick={reset}>
                  <X className="size-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <Label>PO Number</Label>
                  <Input className="mt-1" value={header.poNumber} readOnly />
                </div>
                <div>
                  <Label>Vendor Name</Label>
                  <Input className="mt-1" value={header.vendorName} readOnly />
                </div>
                <div>
                  <Label>Delivery DateTime</Label>
                  <Input
                    className="mt-1"
                    type="datetime-local"
                    value={header.deliveryTime?.slice(0, 16)}
                    onChange={(event) => updateHeader({ deliveryTime: event.target.value })}
                  />
                </div>
                <div>
                  <Label>Place of Delivery</Label>
                  <Textarea
                    className="mt-1"
                    rows={2}
                    value={header.deliveryPlace}
                    onChange={(event) => updateHeader({ deliveryPlace: event.target.value })}
                  />
                </div>
                <div>
                  <Label>Payment Terms</Label>
                  <Textarea
                    className="mt-1"
                    rows={2}
                    value={header.paymentTerms}
                    onChange={(event) => updateHeader({ paymentTerms: event.target.value })}
                  />
                </div>
                <div>
                  <Label>Remarks</Label>
                  <Textarea
                    className="mt-1"
                    rows={2}
                    value={header.remarks}
                    onChange={(event) => updateHeader({ remarks: event.target.value })}
                  />
                </div>
                <div>
                  <Label>Transportation Charge</Label>
                  <Input
                    className="mt-1"
                    type="number"
                    min={0}
                    value={header.transportation}
                    onChange={(event) => updateHeader({ transportation: event.target.value })}
                  />
                </div>
                <div>
                  <Label>Installation Charge</Label>
                  <Input
                    className="mt-1"
                    type="number"
                    min={0}
                    value={header.installation}
                    onChange={(event) => updateHeader({ installation: event.target.value })}
                  />
                </div>
              </div>

              {rows.length > 0 && (
                <div className="mt-5 overflow-x-auto rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Discount %</TableHead>
                        <TableHead>Discount Amount</TableHead>
                        <TableHead>After Discount</TableHead>
                        <TableHead>Tax %</TableHead>
                        <TableHead>Tax Amount</TableHead>
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row, index) => {
                        const calculated = amounts(row);
                        return (
                          <TableRow key={`${row.itemId}-${index}`}>
                            <TableCell>{row.itemName}</TableCell>
                            <TableCell>{row.price}</TableCell>
                            <TableCell>
                              <Input
                                className="min-w-20"
                                type="number"
                                min={0.01}
                                value={row.quantity}
                                onChange={(event) => updateRow(index, { quantity: event.target.value })}
                              />
                            </TableCell>
                            <TableCell>{calculated.amount.toFixed(2)}</TableCell>
                            <TableCell>
                              <Input
                                className="min-w-20"
                                type="number"
                                min={0}
                                value={row.discount}
                                onChange={(event) => updateRow(index, { discount: event.target.value })}
                              />
                            </TableCell>
                            <TableCell>{calculated.discountAmount.toFixed(2)}</TableCell>
                            <TableCell>{calculated.afterDiscount.toFixed(2)}</TableCell>
                            <TableCell>
                              <Input
                                className="min-w-20"
                                type="number"
                                min={0}
                                value={row.tax}
                                onChange={(event) => updateRow(index, { tax: event.target.value })}
                              />
                            </TableCell>
                            <TableCell>{calculated.taxAmount.toFixed(2)}</TableCell>
                            <TableCell>{calculated.afterTax.toFixed(2)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Approval Status *</Label>
                  <select
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                    value={header.approvalStatus}
                    onChange={(event) => updateHeader({ approvalStatus: event.target.value })}
                  >
                    <option value="">Select Status</option>
                    {data.options.statuses?.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Approval Remark</Label>
                  <Textarea
                    className="mt-1"
                    rows={2}
                    value={header.approvalRemark}
                    onChange={(event) => updateHeader({ approvalRemark: event.target.value })}
                  />
                </div>
              </div>

              <div className="mt-5">
                <Button onClick={() => void save()} disabled={busy}>
                  {busy && <LoaderCircle className="size-4 animate-spin" />}
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="border-b">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-9"
                  placeholder="Search negotiate PO..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <Button variant="outline" onClick={() => void load()}>
                <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} /> Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sr.</TableHead>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Discount %</TableHead>
                    <TableHead>Tax %</TableHead>
                    <TableHead>Approval Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="h-32 text-center">
                        <LoaderCircle className="mx-auto size-6 animate-spin" />
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="h-32 text-center text-slate-500">
                        No negotiate POs found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((record, index) => (
                      <TableRow key={record.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{text(record, "po_number")}</TableCell>
                        <TableCell>{text(record, "item_name")}</TableCell>
                        <TableCell>{text(record, "vendor_name")}</TableCell>
                        <TableCell>{text(record, "price")}</TableCell>
                        <TableCell>{text(record, "qty")}</TableCell>
                        <TableCell>{text(record, "dis_per")}</TableCell>
                        <TableCell>{text(record, "tax_per")}</TableCell>
                        <TableCell>{text(record, "po_approval_status")}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => startEdit(record)}>
                              <Pencil className="size-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => void remove(record)}>
                              <Trash2 className="size-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
