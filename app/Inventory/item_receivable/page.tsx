<<<<<<< HEAD
import { InventoryPage } from "../_components/InventoryPage"; import { configs } from "../configs";
export default function Page() { return <InventoryPage config={configs.item_receivable} />; }
=======
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LoaderCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { loadInventory, type InventoryData, type InventoryOption } from "../api";
import { loadReceivablePoItems, saveReceivableItems, type ReceivablePoItem } from "../api";

function text(value: unknown): string {
  return value == null ? "" : String(value);
}

export default function ItemReceivablePage() {
  const [data, setData] = useState<InventoryData>({ records: [], options: {} });
  const [poNumber, setPoNumber] = useState("");
  const [items, setItems] = useState<ReceivablePoItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  const approvedPos = useMemo(() => data.options.approved_purchase_orders ?? data.options.purchase_orders ?? [], [data.options]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadInventory("receivables", {}).then((result) => {
      if (!cancelled) {
        setData(result);
        setLoading(false);
      }
    }).catch((reason) => {
      if (!cancelled) {
        setError(reason instanceof Error ? reason.message : "Inventory data could not be loaded.");
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const onPoChange = useCallback(async (value: string) => {
    setPoNumber(value);
    setError("");
    setNotice("");
    if (!value) {
      setItems([]);
      return;
    }
    setBusy(true);
    try {
      const poItems = await loadReceivablePoItems(value);
      setItems(poItems);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "PO items could not be loaded.");
      setItems([]);
    } finally {
      setBusy(false);
    }
  }, []);

  const updateItem = useCallback((itemId: number, patch: Partial<ReceivablePoItem>) => {
    setItems((prev) => prev.map((item) => item.item_id === itemId ? { ...item, ...patch } : item));
  }, []);

  const onSubmit = useCallback(async () => {
    if (!poNumber) {
      setError("Please select a PO number.");
      return;
    }
    const missing = items.find((item) => !item.actual_received_qty && item.actual_received_qty !== 0);
    if (missing) {
      setError(`Received quantity is required for ${missing.item_name}.`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const msg = await saveReceivableItems(poNumber, items);
      setNotice(msg);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Items could not be saved.");
    } finally {
      setBusy(false);
    }
  }, [poNumber, items]);

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <div>
          <h1 className="text-2xl font-bold">Item Receivable</h1>
          <p className="mt-1 text-sm text-slate-500">Manage the item receivable workflow.</p>
        </div>
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Select Purchase Order</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="po_number">Approved PO</Label>
                <select
                  id="po_number"
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                  value={poNumber}
                  onChange={(event) => onPoChange(event.target.value)}
                >
                  <option value="">All / Select PO</option>
                  {approvedPos.map((po) => (
                    <option key={po.id} value={text(po.id)}>{po.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {poNumber && (
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Items for PO: {poNumber}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>PO Qty</TableHead>
                      <TableHead>Previous Received</TableHead>
                      <TableHead>Actual Received Qty</TableHead>
                      <TableHead>Pending Qty</TableHead>
                      <TableHead>Remarks</TableHead>
                      <TableHead>Warranty Start</TableHead>
                      <TableHead>Warranty End</TableHead>
                      <TableHead>Bill No.</TableHead>
                      <TableHead>Bill Date</TableHead>
                      <TableHead>Challan No.</TableHead>
                      <TableHead>Challan Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={12} className="h-32 text-center"><LoaderCircle className="mx-auto size-6 animate-spin" /></TableCell></TableRow>
                    ) : items.length === 0 ? (
                      <TableRow><TableCell colSpan={12} className="h-32 text-center text-slate-500">No items found for this PO.</TableCell></TableRow>
                    ) : items.map((item) => (
                      <TableRow key={item.item_id}>
                        <TableCell>{item.item_name}</TableCell>
                        <TableCell>{item.qty}</TableCell>
                        <TableCell>{item.previous_receive_qty}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            className="h-9 w-24"
                            value={text(item.actual_received_qty)}
                            onChange={(event) => updateItem(item.item_id, { actual_received_qty: Number(event.target.value) })}
                          />
                        </TableCell>
                        <TableCell>{item.pending_qty}</TableCell>
                        <TableCell>
                          <Textarea
                            className="min-w-[160px]"
                            value={text(item.remarks)}
                            onChange={(event) => updateItem(item.item_id, { remarks: event.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            className="h-9 w-40"
                            value={text(item.warranty_start_date)}
                            onChange={(event) => updateItem(item.item_id, { warranty_start_date: event.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            className="h-9 w-40"
                            value={text(item.warranty_end_date)}
                            onChange={(event) => updateItem(item.item_id, { warranty_end_date: event.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-9 w-32"
                            value={text(item.bill_no)}
                            onChange={(event) => updateItem(item.item_id, { bill_no: event.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            className="h-9 w-40"
                            value={text(item.bill_date)}
                            onChange={(event) => updateItem(item.item_id, { bill_date: event.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-9 w-32"
                            value={text(item.challan_no)}
                            onChange={(event) => updateItem(item.item_id, { challan_no: event.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            className="h-9 w-40"
                            value={text(item.challan_date)}
                            onChange={(event) => updateItem(item.item_id, { challan_date: event.target.value })}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-5">
                <Button onClick={() => void onSubmit()} disabled={busy || items.length === 0}>
                  {busy && <LoaderCircle className="size-4 animate-spin" />}
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
