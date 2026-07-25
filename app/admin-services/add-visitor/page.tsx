"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, LogOut, Save, Trash2, UserPlus } from "lucide-react";
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
import { formatDisplayDate, nowTime, todayIso } from "../_lib/dates";
import {
  APPOINTMENT_TYPES,
  createVisitor,
  deleteVisitor,
  loadTodaysVisitors,
  loadVisitorFormSources,
  updateVisitor,
  type AppointmentType,
  type VisitorFormSources,
  type VisitorInput,
  type VisitorRecord,
} from "../_lib/visitor";

const emptySources: VisitorFormSources = {
  visitorTypes: [],
  staff: [],
  students: [],
  visitorTypeSourceMissing: false,
};

function emptyInput(): VisitorInput {
  return {
    appointmentType: "Direct",
    visitorType: "",
    name: "",
    contact: "",
    email: "",
    comingFrom: "",
    toMeet: "",
    relation: "",
    purpose: "",
    visitorIdCard: "",
    meetDate: todayIso(),
    inTime: nowTime(),
    photo: null,
  };
}

export default function AddVisitorPage() {
  const [sources, setSources] = useState<VisitorFormSources>(emptySources);
  const [visitors, setVisitors] = useState<VisitorRecord[]>([]);
  const [input, setInput] = useState<VisitorInput>(emptyInput);
  const [editing, setEditing] = useState<VisitorRecord | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [formSources, register] = await Promise.all([
        loadVisitorFormSources(),
        loadTodaysVisitors(),
      ]);
      setSources(formSources);
      setVisitors(register);
    } catch (value: unknown) {
      setError(errorMessage(value, "The visitor screen could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Browser storage supplies the ERP session, so this must run after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function update(patch: Partial<VisitorInput>) {
    setInput((current) => ({ ...current, ...patch }));
  }

  function startEdit(visitor: VisitorRecord) {
    setEditing(visitor);
    setError("");
    setNotice("");
    setInput({
      appointmentType: (APPOINTMENT_TYPES.find((entry) => entry.value === visitor.appointmentType)
        ?.value ?? "Direct") as AppointmentType,
      visitorType: visitor.visitorType,
      name: visitor.name,
      contact: visitor.contact,
      email: visitor.email,
      comingFrom: visitor.comingFrom,
      toMeet: visitor.toMeet,
      relation: visitor.relation,
      purpose: visitor.purpose,
      visitorIdCard: visitor.visitorIdCard,
      meetDate: visitor.meetDate || todayIso(),
      inTime: visitor.inTime || nowTime(),
      photo: null,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditing(null);
    setInput(emptyInput());
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");

    // Mirrors the required attributes on the Blade form.
    if (!input.appointmentType || !input.visitorType || !input.name.trim() || !input.contact.trim()) {
      setError("Appointment type, visitor type, visitor name and contact are required.");
      return;
    }
    if (!input.toMeet) {
      setError("Select the person the visitor is here to meet.");
      return;
    }
    if (!input.purpose.trim()) {
      setError("Purpose of the visit is required.");
      return;
    }
    if (input.appointmentType !== "Direct" && (!input.meetDate || !input.inTime)) {
      setError("A prior or pick-up visit needs a meeting date and check-in time.");
      return;
    }

    setSaving(true);
    try {
      const message = editing
        ? await updateVisitor(editing.id, input, editing)
        : await createVisitor(input);
      setNotice(message);
      cancelEdit();
      await load();
    } catch (value: unknown) {
      setError(errorMessage(value, "The visitor could not be saved."));
    } finally {
      setSaving(false);
    }
  }

  async function checkOut(visitor: VisitorRecord) {
    setError("");
    setNotice("");
    if (!window.confirm(`Check out ${visitor.name}? The exit SMS is sent once.`)) return;

    setBusy(true);
    try {
      const message = await updateVisitor(
        visitor.id,
        {
          appointmentType: (visitor.appointmentType || "Direct") as AppointmentType,
          visitorType: visitor.visitorType,
          name: visitor.name,
          contact: visitor.contact,
          email: visitor.email,
          comingFrom: visitor.comingFrom,
          toMeet: visitor.toMeet,
          relation: visitor.relation,
          purpose: visitor.purpose,
          visitorIdCard: visitor.visitorIdCard,
          meetDate: visitor.meetDate,
          inTime: visitor.inTime,
          photo: null,
        },
        // Omitting `out_time` is what makes the controller stamp the check-out.
        { ...visitor, outTime: "" }
      );
      setNotice(message);
      await load();
    } catch (value: unknown) {
      setError(errorMessage(value, "The visitor could not be checked out."));
    } finally {
      setBusy(false);
    }
  }

  async function remove(visitor: VisitorRecord) {
    setError("");
    setNotice("");
    if (!window.confirm(`Delete the visitor entry for ${visitor.name}?`)) return;

    setBusy(true);
    try {
      setNotice(await deleteVisitor(visitor.id));
      await load();
    } catch (value: unknown) {
      setError(errorMessage(value, "The visitor could not be deleted."));
    } finally {
      setBusy(false);
    }
  }

  const columns: Array<RecordColumn<VisitorRecord>> = [
    { key: "date", label: "Date", value: (row) => formatDisplayDate(row.meetDate) },
    { key: "in_time", label: "Check in", value: (row) => row.inTime },
    { key: "out_time", label: "Check out", value: (row) => row.outTime || "—" },
    { key: "appointment_type", label: "Appointment type", value: (row) => row.appointmentType },
    { key: "visitor_type", label: "Visitor type", value: (row) => row.visitorTypeName },
    { key: "name", label: "Visitor name", value: (row) => row.name },
    { key: "contact", label: "Contact", value: (row) => row.contact },
    { key: "email", label: "Email", value: (row) => row.email },
    { key: "visitor_idcard", label: "ID card", value: (row) => row.visitorIdCard },
    { key: "coming_from", label: "Coming from", value: (row) => row.comingFrom },
    { key: "to_meet", label: "To meet", value: (row) => row.staffName },
    { key: "relation", label: "Relation", value: (row) => row.relation },
    { key: "purpose", label: "Purpose", value: (row) => row.purpose },
    { key: "created_by", label: "Created by", value: (row) => row.createdBy },
  ];

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <ErpPageHeader
        title="Add visitor"
        description="Record gate visits, check visitors out and keep today's register."
        onRefresh={() => void load()}
        refreshing={loading || saving || busy}
      />

      <ErpAlert tone="error">{error}</ErpAlert>
      <ErpAlert tone="success">{notice}</ErpAlert>
      {!loading && sources.visitorTypeSourceMissing ? (
        <ErpAlert tone="info">
          No visitor type could be resolved, so a visitor cannot be added yet. The ERP has no API
          that lists the visitor type master — the only endpoint that reads it fails for API callers
          — so the options here are recovered from types already used in the register, and this
          institute has none. A backend endpoint for the visitor type master is needed.
        </ErpAlert>
      ) : null}

      {loading ? (
        <ErpSection title="Visitor details">
          <ErpLoading label="Loading visitor types and staff…" />
        </ErpSection>
      ) : (
        <form onSubmit={submit}>
          <ErpSection
            title={editing ? `Edit visitor — ${editing.name}` : "Visitor details"}
            description="A direct visit is stamped with today's date and the current time by the ERP."
            icon={<UserPlus className="size-5" />}
            footer={
              <>
                {editing ? (
                  <Button type="button" variant="outline" onClick={cancelEdit}>
                    Cancel
                  </Button>
                ) : null}
                <Button type="submit" disabled={saving || sources.visitorTypeSourceMissing}>
                  {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                  {editing ? "Update visitor" : "Add visitor"}
                </Button>
              </>
            }
          >
            <div className="space-y-5">
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-slate-700">Appointment type *</legend>
                <div className="flex flex-wrap gap-4">
                  {APPOINTMENT_TYPES.map((option) => (
                    <label key={option.value} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="radio"
                        name="appointment-type"
                        className="size-4 accent-blue-600"
                        checked={input.appointmentType === option.value}
                        onChange={() => update({ appointmentType: option.value })}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="visitor-type">Visitor type *</Label>
                  <select
                    id="visitor-type"
                    className={erpSelectClass}
                    value={input.visitorType}
                    onChange={(event) => update({ visitorType: event.target.value })}
                    required
                  >
                    <option value="">Select</option>
                    {sources.visitorTypes.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="visitor-name">Visitor name *</Label>
                  <Input
                    id="visitor-name"
                    value={input.name}
                    onChange={(event) => update({ name: event.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="visitor-contact">Contact *</Label>
                  <Input
                    id="visitor-contact"
                    inputMode="tel"
                    value={input.contact}
                    onChange={(event) => update({ contact: event.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="visitor-email">Email</Label>
                  <Input
                    id="visitor-email"
                    type="email"
                    value={input.email}
                    onChange={(event) => update({ email: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="visitor-coming-from">Coming from</Label>
                  <Input
                    id="visitor-coming-from"
                    value={input.comingFrom}
                    onChange={(event) => update({ comingFrom: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="visitor-to-meet">To meet *</Label>
                  <select
                    id="visitor-to-meet"
                    className={erpSelectClass}
                    value={input.toMeet}
                    onChange={(event) => update({ toMeet: event.target.value })}
                    required
                  >
                    <option value="">Select staff member</option>
                    {sources.staff.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="visitor-relation">Relation</Label>
                  <Input
                    id="visitor-relation"
                    value={input.relation}
                    onChange={(event) => update({ relation: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="visitor-idcard">Visitor ID card</Label>
                  <Input
                    id="visitor-idcard"
                    value={input.visitorIdCard}
                    onChange={(event) => update({ visitorIdCard: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="visitor-photo">Visitor photo</Label>
                  <input
                    id="visitor-photo"
                    type="file"
                    accept="image/*"
                    className={`${erpInputClass} py-2 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm file:text-slate-700`}
                    onChange={(event) => update({ photo: event.target.files?.[0] ?? null })}
                  />
                </div>

                {input.appointmentType !== "Direct" ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="visitor-meet-date">Meeting date *</Label>
                      <Input
                        id="visitor-meet-date"
                        type="date"
                        value={input.meetDate}
                        onChange={(event) => update({ meetDate: event.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="visitor-in-time">Check-in time *</Label>
                      <Input
                        id="visitor-in-time"
                        type="time"
                        value={input.inTime}
                        onChange={(event) => update({ inTime: event.target.value })}
                        required
                      />
                    </div>
                  </>
                ) : null}

                <div className="space-y-2 md:col-span-3">
                  <Label htmlFor="visitor-purpose">Purpose *</Label>
                  <Textarea
                    id="visitor-purpose"
                    rows={2}
                    value={input.purpose}
                    onChange={(event) => update({ purpose: event.target.value })}
                    required
                  />
                </div>
              </div>
            </div>
          </ErpSection>
        </form>
      )}

      <ErpSection
        title="Today's visitors"
        description="Rows still inside the campus are highlighted."
        icon={<UserPlus className="size-5" />}
      >
        {loading ? (
          <ErpLoading label="Loading today's register…" />
        ) : (
          <RecordTable
            rows={visitors}
            columns={columns}
            getRowKey={(row) => row.id}
            rowClassName={(row) => (row.stillInside ? "bg-emerald-50" : undefined)}
            searchPlaceholder="Search visitors…"
            exportFilename="visitors-today"
            exportTitle="Visitors — today"
            exportSubtitle={formatDisplayDate(todayIso())}
            emptyTitle="No visitors recorded today."
            emptyHint="Use the form above to check a visitor in."
            actions={(row) => (
              <div className="flex flex-wrap gap-1">
                {!row.outTime ? (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => void checkOut(row)}>
                    <LogOut className="size-3.5" />
                    Out
                  </Button>
                ) : null}
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
