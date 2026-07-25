"use client";

import { useCallback, useEffect, useState } from "react";
import { ImageIcon, LoaderCircle, Save, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ErpAlert,
  ErpLoading,
  ErpPageHeader,
  ErpSection,
  erpInputClass,
  erpSelectClass,
} from "@/components/erp/erp-ui";
import { RecordTable, type RecordColumn } from "@/components/erp/RecordTable";
import { errorMessage } from "@/lib/erp-legacy";
import { formatDisplayDate, todayIso } from "../_lib/dates";
import {
  createPettyCashEntry,
  deletePettyCashEntry,
  loadPettyCashBoard,
  updatePettyCashEntry,
  type PettyCashBoard,
  type PettyCashEntry,
  type PettyCashEntryInput,
} from "../_lib/pettyCash";

const emptyBoard: PettyCashBoard = { entries: [], heads: [] };

function emptyInput(): PettyCashEntryInput {
  return { createdOn: todayIso(), titleId: "", amount: "", description: "", billImage: null };
}

export default function PettyCashPage() {
  const [board, setBoard] = useState<PettyCashBoard>(emptyBoard);
  const [input, setInput] = useState<PettyCashEntryInput>(emptyInput);
  const [editing, setEditing] = useState<PettyCashEntry | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setBoard(await loadPettyCashBoard());
    } catch (value: unknown) {
      setError(errorMessage(value, "Petty cash entries could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Browser storage supplies the ERP session, so this must run after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function cancelEdit() {
    setEditing(null);
    setInput(emptyInput());
  }

  function startEdit(entry: PettyCashEntry) {
    setEditing(entry);
    setError("");
    setNotice("");
    setInput({
      createdOn: entry.billDate || todayIso(),
      titleId: entry.titleId ? String(entry.titleId) : "",
      amount: entry.amount,
      description: entry.description,
      billImage: null,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!input.createdOn || !input.titleId || !input.amount.trim()) {
      setError("Date, title and amount are required.");
      return;
    }
    // `petty_cash.amount` is an INT column, so fractions would be truncated.
    if (!/^\d+$/.test(input.amount.trim()) || Number(input.amount) <= 0) {
      setError("Amount must be a whole number greater than zero.");
      return;
    }

    setSaving(true);
    try {
      const message = editing
        ? await updatePettyCashEntry(editing.id, input)
        : await createPettyCashEntry(input);
      setNotice(message);
      cancelEdit();
      await load();
    } catch (value: unknown) {
      setError(errorMessage(value, "The petty cash entry could not be saved."));
    } finally {
      setSaving(false);
    }
  }

  async function remove(entry: PettyCashEntry) {
    setError("");
    setNotice("");
    if (!window.confirm(`Delete the ${entry.titleName} entry of ${entry.amount}?`)) return;

    setBusy(true);
    try {
      setNotice(await deletePettyCashEntry(entry.id));
      if (editing?.id === entry.id) cancelEdit();
      await load();
    } catch (value: unknown) {
      setError(errorMessage(value, "The entry could not be deleted."));
    } finally {
      setBusy(false);
    }
  }

  const columns: Array<RecordColumn<PettyCashEntry>> = [
    { key: "bill_date", label: "Date", value: (row) => formatDisplayDate(row.billDate) },
    { key: "title", label: "Title", value: (row) => row.titleName },
    { key: "amount", label: "Amount", align: "right", value: (row) => row.amount },
    { key: "description", label: "Description", value: (row) => row.description },
    { key: "user", label: "Booked by", value: (row) => row.userName },
    {
      key: "bill_image",
      label: "Bill image",
      value: (row) => row.billImage,
      sortable: false,
      render: (row) =>
        row.billImage ? (
          <span className="inline-flex items-center gap-1 text-slate-600">
            <ImageIcon className="size-3.5" />
            <span className="font-mono text-xs">{row.billImage}</span>
          </span>
        ) : (
          "—"
        ),
    },
  ];

  const total = board.entries.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <ErpPageHeader
        title="Petty cash"
        description="Record day-to-day cash expenses against a petty cash head."
        onRefresh={() => void load()}
        refreshing={loading || saving || busy}
      />

      <ErpAlert tone="error">{error}</ErpAlert>
      <ErpAlert tone="success">{notice}</ErpAlert>

      {loading ? (
        <ErpSection title="New entry">
          <ErpLoading label="Loading petty cash heads…" />
        </ErpSection>
      ) : (
        <form onSubmit={submit}>
          <ErpSection
            title={editing ? `Edit entry — ${editing.titleName}` : "New entry"}
            description={
              board.heads.length === 0
                ? "Add a petty cash head first — entries must be booked against one."
                : editing
                  ? "The person who booked the expense is preserved."
                  : undefined
            }
            icon={<Wallet className="size-5" />}
            footer={
              <>
                {editing ? (
                  <Button type="button" variant="outline" onClick={cancelEdit}>
                    Cancel
                  </Button>
                ) : null}
                <Button type="submit" disabled={saving || board.heads.length === 0}>
                  {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                  {saving ? "Saving…" : editing ? "Update entry" : "Add entry"}
                </Button>
              </>
            }
          >
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="pc-date">Date *</Label>
                <Input
                  id="pc-date"
                  type="date"
                  value={input.createdOn}
                  onChange={(event) => setInput({ ...input, createdOn: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pc-title">Title *</Label>
                <select
                  id="pc-title"
                  className={erpSelectClass}
                  value={input.titleId}
                  onChange={(event) => setInput({ ...input, titleId: event.target.value })}
                  required
                >
                  <option value="">Select title</option>
                  {board.heads.map((head) => (
                    <option key={head.id} value={head.id}>
                      {head.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pc-amount">Amount *</Label>
                <Input
                  id="pc-amount"
                  type="number"
                  min="1"
                  step="1"
                  value={input.amount}
                  onChange={(event) => setInput({ ...input, amount: event.target.value })}
                  required
                />
                <p className="text-xs text-slate-500">Whole numbers only.</p>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="pc-description">Description</Label>
                <Textarea
                  id="pc-description"
                  rows={2}
                  value={input.description}
                  onChange={(event) => setInput({ ...input, description: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pc-bill">
                  Bill image{editing && editing.billImage ? " (replaces the current file)" : ""}
                </Label>
                <input
                  id="pc-bill"
                  type="file"
                  accept="image/*"
                  className={`${erpInputClass} py-2 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm file:text-slate-700`}
                  onChange={(event) =>
                    setInput({ ...input, billImage: event.target.files?.[0] ?? null })
                  }
                />
                {editing && editing.billImage ? (
                  <p className="font-mono text-xs text-slate-500">{editing.billImage}</p>
                ) : null}
              </div>
            </div>
          </ErpSection>
        </form>
      )}

      <ErpSection
        title="Entries"
        description={
          board.entries.length > 0 ? `Total booked: ${total.toLocaleString("en-IN")}` : undefined
        }
        icon={<Wallet className="size-5" />}
      >
        {loading ? (
          <ErpLoading label="Loading entries…" />
        ) : (
          <RecordTable
            rows={board.entries}
            columns={columns}
            getRowKey={(row) => row.id}
            searchPlaceholder="Search entries…"
            exportFilename="petty-cash-entries"
            exportTitle="Petty cash entries"
            emptyTitle="No petty cash entries yet."
            emptyHint="Use the form above to record the first expense."
            actions={(row) => (
              <div className="flex gap-1">
                <Button size="sm" variant="outline" disabled={busy} onClick={() => startEdit(row)}>
                  Edit
                </Button>
                <Button size="sm" variant="destructive" disabled={busy} onClick={() => void remove(row)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            )}
          />
        )}
      </ErpSection>
    </main>
  );
}
