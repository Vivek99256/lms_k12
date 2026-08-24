"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, Save, Tags, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErpAlert, ErpLoading, ErpPageHeader, ErpSection } from "@/components/erp/erp-ui";
import { RecordTable, type RecordColumn } from "@/components/erp/RecordTable";
import { errorMessage } from "@/lib/erp-legacy";
import {
  createPettyCashHead,
  deletePettyCashHead,
  loadPettyCashHeads,
  updatePettyCashHead,
  type PettyCashHead,
} from "../_lib/pettyCash";

const columns: Array<RecordColumn<PettyCashHead>> = [
  { key: "title", label: "Title", value: (row) => row.title },
];

export default function PettyCashMasterPage() {
  const [heads, setHeads] = useState<PettyCashHead[]>([]);
  const [title, setTitle] = useState("");
  const [editing, setEditing] = useState<PettyCashHead | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setHeads(await loadPettyCashHeads());
    } catch (value: unknown) {
      setError(errorMessage(value, "Petty cash heads could not be loaded."));
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
    setTitle("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    setSaving(true);
    try {
      const message = editing
        ? await updatePettyCashHead(editing.id, title.trim())
        : await createPettyCashHead(title.trim());
      setNotice(message);
      cancelEdit();
      await load();
    } catch (value: unknown) {
      setError(errorMessage(value, "The petty cash head could not be saved."));
    } finally {
      setSaving(false);
    }
  }

  async function remove(head: PettyCashHead) {
    setError("");
    setNotice("");
    if (
      !window.confirm(
        `Delete the petty cash head "${head.title}"? Existing entries reference it by id.`
      )
    ) {
      return;
    }

    setBusy(true);
    try {
      setNotice(await deletePettyCashHead(head.id));
      if (editing?.id === head.id) cancelEdit();
      await load();
    } catch (value: unknown) {
      setError(errorMessage(value, "The petty cash head could not be deleted."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <ErpPageHeader
        title="Petty cash master"
        description="The expense heads that petty cash entries are booked against."
        onRefresh={() => void load()}
        refreshing={loading || saving || busy}
      />

      <ErpAlert tone="error">{error}</ErpAlert>
      <ErpAlert tone="success">{notice}</ErpAlert>

      <form onSubmit={submit}>
        <ErpSection
          title={editing ? `Edit head — ${editing.title}` : "Add head"}
          icon={<Tags className="size-5" />}
          footer={
            <>
              {editing ? (
                <Button type="button" variant="outline" onClick={cancelEdit}>
                  Cancel
                </Button>
              ) : null}
              <Button type="submit" disabled={saving}>
                {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                {editing ? "Update head" : "Add head"}
              </Button>
            </>
          }
        >
          <div className="grid gap-4 sm:max-w-md">
            <div className="space-y-2">
              <Label htmlFor="head-title">Title *</Label>
              <Input
                id="head-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
              />
            </div>
          </div>
        </ErpSection>
      </form>

      <ErpSection title="Heads" icon={<Tags className="size-5" />}>
        {loading ? (
          <ErpLoading label="Loading petty cash heads…" />
        ) : (
          <RecordTable
            rows={heads}
            columns={columns}
            getRowKey={(row) => row.id}
            searchPlaceholder="Search heads…"
            exportFilename="petty-cash-heads"
            exportTitle="Petty cash heads"
            emptyTitle="No petty cash heads yet."
            emptyHint="Add a head before recording petty cash entries."
            actions={(row) => (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setEditing(row);
                    setTitle(row.title);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
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
