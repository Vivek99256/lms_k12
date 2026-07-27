"use client";

import { useCallback, useEffect, useState } from "react";
import { ConciergeBell, LoaderCircle, Save, Trash2 } from "lucide-react";
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
import { RecordTable, type RecordColumn } from "@/components/erp/RecordTable";
import { errorMessage } from "@/lib/erp-legacy";
import { formatDisplayDate, nowTime, todayIso } from "../_lib/dates";
import {
  FRONT_DESK_VISITOR_TYPES,
  createFrontDeskEntry,
  deleteFrontDeskEntry,
  loadFrontDeskBoard,
  updateFrontDeskEntry,
  type FrontDeskBoard,
  type FrontDeskInput,
  type FrontDeskRecord,
  type FrontDeskVisitorType,
} from "../_lib/frontdesk";
import { loadStudentOptions, type VisitorStudentOption } from "../_lib/visitor";

const emptyBoard: FrontDeskBoard = { entries: [], staff: [], isAdmin: false };

function emptyInput(): FrontDeskInput {
  return {
    visitorType: "",
    title: "",
    description: "",
    studentId: "",
    toWhomMeetId: "",
    date: todayIso(),
    inTime: nowTime(),
    outTime: "",
    photo: null,
  };
}

export default function FrontDeskPage() {
  const [board, setBoard] = useState<FrontDeskBoard>(emptyBoard);
  const [students, setStudents] = useState<VisitorStudentOption[]>([]);
  const [input, setInput] = useState<FrontDeskInput>(emptyInput);
  const [editing, setEditing] = useState<FrontDeskRecord | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextBoard, studentList] = await Promise.all([
        loadFrontDeskBoard(),
        // The Blade form types a student name into an autocomplete; the
        // stateless admin student list backs the dropdown here.
        loadStudentOptions(),
      ]);
      setBoard(nextBoard);
      setStudents(studentList);
    } catch (value: unknown) {
      setError(errorMessage(value, "The front desk screen could not be loaded."));
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

  function startEdit(entry: FrontDeskRecord) {
    setEditing(entry);
    setError("");
    setNotice("");
    setInput({
      visitorType: (FRONT_DESK_VISITOR_TYPES.find((type) => type.value === entry.visitorType)
        ?.value ?? "") as FrontDeskVisitorType | "",
      title: entry.title,
      description: entry.description,
      studentId: entry.studentId ? String(entry.studentId) : "",
      toWhomMeetId: entry.toWhomMeetId ? String(entry.toWhomMeetId) : "",
      date: entry.date || todayIso(),
      inTime: entry.inTime || nowTime(),
      outTime: entry.outTime,
      photo: null,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");

    // Every field below is `required` on the Blade form.
    if (
      !input.visitorType ||
      !input.title.trim() ||
      !input.description.trim() ||
      !input.studentId ||
      !input.toWhomMeetId ||
      !input.date ||
      !input.inTime
    ) {
      setError("Visitor type, title, description, student, staff member, date and time are required.");
      return;
    }
    if (input.outTime && input.outTime < input.inTime) {
      setError("Out time cannot be earlier than in time.");
      return;
    }

    setSaving(true);
    try {
      const message = editing
        ? await updateFrontDeskEntry(editing.id, input)
        : await createFrontDeskEntry(input);
      setNotice(message);
      cancelEdit();
      await load();
    } catch (value: unknown) {
      setError(errorMessage(value, "The front desk entry could not be saved."));
    } finally {
      setSaving(false);
    }
  }

  async function remove(entry: FrontDeskRecord) {
    setError("");
    setNotice("");
    if (!window.confirm(`Delete the front desk entry "${entry.title}"?`)) return;

    setBusy(true);
    try {
      setNotice(await deleteFrontDeskEntry(entry.id));
      if (editing?.id === entry.id) cancelEdit();
      await load();
    } catch (value: unknown) {
      setError(errorMessage(value, "The entry could not be deleted."));
    } finally {
      setBusy(false);
    }
  }

  const columns: Array<RecordColumn<FrontDeskRecord>> = [
    { key: "title", label: "Title", value: (row) => row.title },
    { key: "description", label: "Description", value: (row) => row.description },
    { key: "student", label: "Student name", value: (row) => row.studentName },
    { key: "visitor_type", label: "Visitor type", value: (row) => row.visitorType },
    { key: "to_whom_meet", label: "To whom meet", value: (row) => row.userName },
    {
      key: "date_time",
      label: "Date-time",
      value: (row) => `${formatDisplayDate(row.date)} ${row.inTime}`.trim(),
    },
    { key: "out_time", label: "Out time", value: (row) => row.outTime || "—" },
  ];

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <ErpPageHeader
        title="Front desk"
        description={
          board.isAdmin
            ? "Log who came in, who they met and why."
            : "Log who came in, who they met and why. You see the entries addressed to you."
        }
        onRefresh={() => void load()}
        refreshing={loading || saving || busy}
      />

      <ErpAlert tone="error">{error}</ErpAlert>
      <ErpAlert tone="success">{notice}</ErpAlert>

      {loading ? (
        <ErpSection title="New front desk entry">
          <ErpLoading label="Loading staff and students…" />
        </ErpSection>
      ) : (
        <form onSubmit={submit}>
          <ErpSection
            title={editing ? `Edit entry — ${editing.title}` : "New front desk entry"}
            description={
              editing ? "The original author is preserved; only the visit details change." : undefined
            }
            icon={<ConciergeBell className="size-5" />}
            footer={
              <>
                {editing ? (
                  <Button type="button" variant="outline" onClick={cancelEdit}>
                    Cancel
                  </Button>
                ) : null}
                <Button type="submit" disabled={saving}>
                  {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                  {saving ? "Saving…" : editing ? "Update entry" : "Add entry"}
                </Button>
              </>
            }
          >
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="fd-visitor-type">Visitor type *</Label>
                <select
                  id="fd-visitor-type"
                  className={erpSelectClass}
                  value={input.visitorType}
                  onChange={(event) =>
                    setInput({ ...input, visitorType: event.target.value as FrontDeskVisitorType })
                  }
                  required
                >
                  <option value="">Select visitor type</option>
                  {FRONT_DESK_VISITOR_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fd-title">Title *</Label>
                <Input
                  id="fd-title"
                  value={input.title}
                  onChange={(event) => setInput({ ...input, title: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fd-description">Description *</Label>
                <Input
                  id="fd-description"
                  value={input.description}
                  onChange={(event) => setInput({ ...input, description: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fd-student">Student *</Label>
                <select
                  id="fd-student"
                  className={erpSelectClass}
                  value={input.studentId}
                  onChange={(event) => setInput({ ...input, studentId: event.target.value })}
                  required
                >
                  <option value="">Select student</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name}
                      {student.enrollmentNo ? ` (${student.enrollmentNo})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fd-to-whom">To whom meet *</Label>
                <select
                  id="fd-to-whom"
                  className={erpSelectClass}
                  value={input.toWhomMeetId}
                  onChange={(event) => setInput({ ...input, toWhomMeetId: event.target.value })}
                  required
                >
                  <option value="">Select staff member</option>
                  {board.staff.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fd-photo">
                  Visitor photo{editing && editing.visitorPhoto ? " (replaces the current file)" : ""}
                </Label>
                <input
                  id="fd-photo"
                  type="file"
                  accept="image/*"
                  className={`${erpInputClass} py-2 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm file:text-slate-700`}
                  onChange={(event) => setInput({ ...input, photo: event.target.files?.[0] ?? null })}
                />
                {editing && editing.visitorPhoto ? (
                  <p className="font-mono text-xs text-slate-500">{editing.visitorPhoto}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="fd-date">Date *</Label>
                <Input
                  id="fd-date"
                  type="date"
                  value={input.date}
                  onChange={(event) => setInput({ ...input, date: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fd-in-time">In time *</Label>
                <Input
                  id="fd-in-time"
                  type="time"
                  value={input.inTime}
                  onChange={(event) => setInput({ ...input, inTime: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fd-out-time">Out time</Label>
                <Input
                  id="fd-out-time"
                  type="time"
                  value={input.outTime}
                  onChange={(event) => setInput({ ...input, outTime: event.target.value })}
                />
              </div>
            </div>
          </ErpSection>
        </form>
      )}

      <ErpSection title="Front desk log" icon={<ConciergeBell className="size-5" />}>
        {loading ? (
          <ErpLoading label="Loading front desk log…" />
        ) : (
          <RecordTable
            rows={board.entries}
            columns={columns}
            getRowKey={(row) => row.id}
            searchPlaceholder="Search entries…"
            exportFilename="front-desk-log"
            exportTitle="Front desk log"
            emptyTitle="No front desk entries yet."
            emptyHint="Use the form above to log the first visit."
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
