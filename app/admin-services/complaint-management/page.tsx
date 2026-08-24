"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, MessageSquareWarning, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ErpAlert,
  ErpLoading,
  ErpPageHeader,
  ErpSection,
  erpInputClass,
  erpSelectClass,
} from "@/components/erp/erp-ui";
import { RecordTable } from "@/components/erp/RecordTable";
import { errorMessage } from "@/lib/erp-legacy";
import { todayIso } from "../_lib/dates";
import { complaintColumns } from "../_components/complaint-columns";
import {
  DEFAULT_COMPLAINT_SOLUTION,
  createComplaint,
  deleteComplaint,
  loadComplaintBoard,
  updateComplaint,
  type ComplaintBoard,
  type ComplaintRecord,
  type ComplaintUpdateInput,
} from "../_lib/complaint";

const emptyBoard: ComplaintBoard = { complaints: [], statuses: [], users: [] };

function emptyInput(): ComplaintUpdateInput {
  return {
    title: "",
    description: "",
    date: todayIso(),
    attachment: null,
    solution: DEFAULT_COMPLAINT_SOLUTION,
    solutionById: "",
  };
}

export default function ComplaintManagementPage() {
  const [board, setBoard] = useState<ComplaintBoard>(emptyBoard);
  const [input, setInput] = useState<ComplaintUpdateInput>(emptyInput);
  const [editing, setEditing] = useState<ComplaintRecord | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setBoard(await loadComplaintBoard());
    } catch (value: unknown) {
      setError(errorMessage(value, "Complaints could not be loaded."));
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

  function startEdit(complaint: ComplaintRecord) {
    setEditing(complaint);
    setError("");
    setNotice("");
    setInput({
      title: complaint.title,
      description: complaint.description,
      date: complaint.date || todayIso(),
      attachment: null,
      solution: complaint.solution || DEFAULT_COMPLAINT_SOLUTION,
      solutionById: complaint.solutionById ? String(complaint.solutionById) : "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");

    // The Blade form marks all three as required.
    if (!input.title.trim() || !input.description.trim() || !input.date) {
      setError("Title, description and date are required.");
      return;
    }

    setSaving(true);
    try {
      const message = editing
        ? await updateComplaint(editing.id, input)
        : await createComplaint(input);
      setNotice(message);
      cancelEdit();
      await load();
    } catch (value: unknown) {
      setError(errorMessage(value, "The complaint could not be saved."));
    } finally {
      setSaving(false);
    }
  }

  async function remove(complaint: ComplaintRecord) {
    setError("");
    setNotice("");
    if (!window.confirm(`Delete the complaint "${complaint.title}"?`)) return;

    setBusy(true);
    try {
      setNotice(await deleteComplaint(complaint.id));
      if (editing?.id === complaint.id) cancelEdit();
      await load();
    } catch (value: unknown) {
      setError(errorMessage(value, "The complaint could not be deleted."));
    } finally {
      setBusy(false);
    }
  }

  // The status master may be empty; always offer the seeded PENDING state.
  const statusOptions = board.statuses.includes(DEFAULT_COMPLAINT_SOLUTION)
    ? board.statuses
    : [DEFAULT_COMPLAINT_SOLUTION, ...board.statuses];

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <ErpPageHeader
        title="Complaint management"
        description="Raise complaints and track how they were resolved."
        onRefresh={() => void load()}
        refreshing={loading || saving || busy}
      />

      <ErpAlert tone="error">{error}</ErpAlert>
      <ErpAlert tone="success">{notice}</ErpAlert>

      <form onSubmit={submit}>
        <ErpSection
          title={editing ? `Edit complaint — ${editing.title}` : "Raise a complaint"}
          description={
            editing
              ? "The original raiser is preserved; only the details and solution change."
              : `New complaints start at ${DEFAULT_COMPLAINT_SOLUTION} and are logged against the signed-in user.`
          }
          icon={<MessageSquareWarning className="size-5" />}
          footer={
            <>
              {editing ? (
                <Button type="button" variant="outline" onClick={cancelEdit}>
                  Cancel
                </Button>
              ) : null}
              <Button type="submit" disabled={saving}>
                {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                {saving ? "Saving…" : editing ? "Update complaint" : "Add complaint"}
              </Button>
            </>
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="complaint-title">Title *</Label>
              <Input
                id="complaint-title"
                value={input.title}
                onChange={(event) => setInput({ ...input, title: event.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="complaint-date">Date *</Label>
              <Input
                id="complaint-date"
                type="date"
                value={input.date}
                onChange={(event) => setInput({ ...input, date: event.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="complaint-description">Description *</Label>
              <Input
                id="complaint-description"
                value={input.description}
                onChange={(event) => setInput({ ...input, description: event.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="complaint-attachment">
                Attachment{editing && editing.attachment ? " (replaces the current file)" : ""}
              </Label>
              <input
                id="complaint-attachment"
                type="file"
                className={`${erpInputClass} py-2 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm file:text-slate-700`}
                onChange={(event) =>
                  setInput({ ...input, attachment: event.target.files?.[0] ?? null })
                }
              />
              {editing && editing.attachment ? (
                <p className="font-mono text-xs text-slate-500">{editing.attachment}</p>
              ) : null}
            </div>

            {editing ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="complaint-solution">Complaint solution</Label>
                  <select
                    id="complaint-solution"
                    className={erpSelectClass}
                    value={input.solution}
                    onChange={(event) => setInput({ ...input, solution: event.target.value })}
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="complaint-solution-by">Complaint solution by</Label>
                  <select
                    id="complaint-solution-by"
                    className={erpSelectClass}
                    value={input.solutionById}
                    onChange={(event) => setInput({ ...input, solutionById: event.target.value })}
                  >
                    <option value="">Select user</option>
                    {board.users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : null}
          </div>
        </ErpSection>
      </form>

      <ErpSection title="Complaints" icon={<MessageSquareWarning className="size-5" />}>
        {loading ? (
          <ErpLoading label="Loading complaints…" />
        ) : (
          <RecordTable
            rows={board.complaints}
            columns={complaintColumns()}
            getRowKey={(row) => row.id}
            searchPlaceholder="Search complaints…"
            exportFilename="complaints"
            exportTitle="Complaints"
            emptyTitle="No complaints raised yet."
            emptyHint="Use the form above to raise the first one."
            actions={(row) => (
              <div className="flex gap-1">
                <Button size="sm" variant="outline" disabled={busy} onClick={() => startEdit(row)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => void remove(row)}
                >
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
