"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, LoaderCircle, Plus, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClassFilters, emptyClassSelection, type ClassSelection } from "@/components/erp/ClassFilters";
import { ErpAlert, ErpLoading, ErpPageHeader, ErpSection } from "@/components/erp/erp-ui";
import { RecordTable, type RecordColumn } from "@/components/erp/RecordTable";
import { emptyClassOptions, loadClassOptions, type ClassOptions } from "@/lib/class-options";
import { errorMessage } from "@/lib/erp-legacy";
import { formatDisplayDate, todayIso } from "../_lib/dates";
import {
  createPtmTimeSlots,
  deletePtmTimeSlot,
  loadPtmTimeSlots,
  updatePtmTimeSlot,
  type PtmTimeSlot,
} from "../_lib/ptm";

type SlotRow = { fromTime: string; toTime: string };

export default function PtmTimeSlotMasterPage() {
  const [classOptions, setClassOptions] = useState<ClassOptions>(emptyClassOptions);
  const [filter, setFilter] = useState<ClassSelection>(emptyClassSelection);
  const [slots, setSlots] = useState<PtmTimeSlot[]>([]);

  const [formClass, setFormClass] = useState<ClassSelection>(emptyClassSelection);
  const [title, setTitle] = useState("");
  const [ptmDate, setPtmDate] = useState(todayIso);
  const [rows, setRows] = useState<SlotRow[]>([{ fromTime: "", toTime: "" }]);
  const [editing, setEditing] = useState<PtmTimeSlot | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(
    async (nextFilter: ClassSelection) => {
      setLoading(true);
      setError("");
      try {
        const [options, slotRows] = await Promise.all([
          classOptions.academicSections.length > 0
            ? Promise.resolve(classOptions)
            : loadClassOptions(),
          loadPtmTimeSlots({
            standardId: nextFilter.standardId,
            divisionId: nextFilter.divisionId,
          }),
        ]);
        setClassOptions(options);
        setSlots(slotRows);
      } catch (value: unknown) {
        setError(errorMessage(value, "PTM time slots could not be loaded."));
      } finally {
        setLoading(false);
      }
    },
    [classOptions]
  );

  useEffect(() => {
    // Browser storage supplies the ERP session, so this must run after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(emptyClassSelection);
    // Intentionally runs once: later reloads are driven by explicit user actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setEditing(null);
    setFormClass(emptyClassSelection);
    setTitle("");
    setPtmDate(todayIso());
    setRows([{ fromTime: "", toTime: "" }]);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!formClass.standardId || !formClass.divisionId || !title.trim() || !ptmDate) {
      setError("Standard, division, title and PTM date are required.");
      return;
    }
    const filled = rows.filter((row) => row.fromTime && row.toTime);
    if (filled.length === 0) {
      setError("Add at least one complete from/to time pair.");
      return;
    }
    if (filled.some((row) => row.fromTime >= row.toTime)) {
      setError("Each slot's from time must be earlier than its to time.");
      return;
    }

    setSaving(true);
    try {
      const message = editing
        ? await updatePtmTimeSlot(editing.id, {
            standardId: formClass.standardId,
            divisionId: formClass.divisionId,
            title: title.trim(),
            ptmDate,
            fromTime: filled[0].fromTime,
            toTime: filled[0].toTime,
          })
        : await createPtmTimeSlots({
            standardId: formClass.standardId,
            divisionId: formClass.divisionId,
            title: title.trim(),
            ptmDate,
            slots: filled,
          });
      setNotice(message);
      resetForm();
      await load(filter);
    } catch (value: unknown) {
      setError(errorMessage(value, "The PTM time slot could not be saved."));
    } finally {
      setSaving(false);
    }
  }

  async function remove(slot: PtmTimeSlot) {
    setError("");
    setNotice("");
    if (!window.confirm(`Delete the ${slot.fromTime}–${slot.toTime} slot for ${slot.title}?`)) return;

    setBusy(true);
    try {
      setNotice(await deletePtmTimeSlot(slot.id));
      if (editing?.id === slot.id) resetForm();
      await load(filter);
    } catch (value: unknown) {
      setError(errorMessage(value, "The PTM time slot could not be deleted."));
    } finally {
      setBusy(false);
    }
  }

  function startEdit(slot: PtmTimeSlot) {
    setEditing(slot);
    setFormClass({
      gradeId:
        String(classOptions.standards.find((standard) => standard.id === slot.standardId)?.gradeId ?? ""),
      standardId: String(slot.standardId),
      divisionId: String(slot.divisionId),
    });
    setTitle(slot.title);
    setPtmDate(slot.ptmDate ? slot.ptmDate.slice(0, 10) : todayIso());
    setRows([{ fromTime: slot.fromTime.slice(0, 5), toTime: slot.toTime.slice(0, 5) }]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const columns: Array<RecordColumn<PtmTimeSlot>> = [
    { key: "standard", label: "Standard", value: (row) => row.standardName },
    { key: "division", label: "Division", value: (row) => row.divisionName },
    { key: "ptm_date", label: "PTM date", value: (row) => formatDisplayDate(row.ptmDate) },
    { key: "title", label: "PTM title", value: (row) => row.title },
    { key: "time_slot", label: "Time slot", value: (row) => `${row.fromTime} - ${row.toTime}` },
  ];

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <ErpPageHeader
        title="PTM time slot master"
        description="Define the meeting slots parents can book for a class."
        onRefresh={() => void load(filter)}
        refreshing={loading || saving || busy}
      />

      <ErpAlert tone="error">{error}</ErpAlert>
      <ErpAlert tone="success">{notice}</ErpAlert>

      {loading && slots.length === 0 ? (
        <ErpSection title="Add time slots">
          <ErpLoading label="Loading classes and slots…" />
        </ErpSection>
      ) : (
        <form onSubmit={submit}>
          <ErpSection
            title={editing ? "Edit time slot" : "Add time slots"}
            description={
              editing
                ? "The ERP updates one slot at a time, so only the first row is saved."
                : "Every from/to pair below is saved as its own slot, all sharing the title and date."
            }
            icon={<CalendarClock className="size-5" />}
            footer={
              <>
                {editing ? (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                ) : null}
                <Button type="submit" disabled={saving}>
                  {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                  {editing ? "Update slot" : "Add slots"}
                </Button>
              </>
            }
          >
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <ClassFilters
                  idPrefix="ptm-slot"
                  options={classOptions}
                  value={formClass}
                  onChange={setFormClass}
                />
                <div className="space-y-2">
                  <Label htmlFor="ptm-title">PTM title *</Label>
                  <Input
                    id="ptm-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ptm-date">PTM date *</Label>
                  <Input
                    id="ptm-date"
                    type="date"
                    value={ptmDate}
                    onChange={(event) => setPtmDate(event.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700">Time slots *</p>
                  {!editing ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setRows((current) => [...current, { fromTime: "", toTime: "" }])}
                    >
                      <Plus className="size-3.5" />
                      Add slot
                    </Button>
                  ) : null}
                </div>
                {rows.map((row, index) => (
                  <div key={index} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <div className="space-y-2">
                      <Label htmlFor={`ptm-from-${index}`}>From time</Label>
                      <Input
                        id={`ptm-from-${index}`}
                        type="time"
                        value={row.fromTime}
                        onChange={(event) =>
                          setRows((current) =>
                            current.map((entry, position) =>
                              position === index ? { ...entry, fromTime: event.target.value } : entry
                            )
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`ptm-to-${index}`}>To time</Label>
                      <Input
                        id={`ptm-to-${index}`}
                        type="time"
                        value={row.toTime}
                        onChange={(event) =>
                          setRows((current) =>
                            current.map((entry, position) =>
                              position === index ? { ...entry, toTime: event.target.value } : entry
                            )
                          )
                        }
                      />
                    </div>
                    {rows.length > 1 && !editing ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        aria-label={`Remove slot ${index + 1}`}
                        onClick={() =>
                          setRows((current) => current.filter((_, position) => position !== index))
                        }
                      >
                        <X className="size-4" />
                      </Button>
                    ) : (
                      <span />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </ErpSection>
        </form>
      )}

      <ErpSection
        title="Defined slots"
        description="Filter the list by class — the ERP applies it server-side."
        icon={<CalendarClock className="size-5" />}
      >
        <div className="mb-4 grid gap-4 md:grid-cols-4">
          <ClassFilters
            idPrefix="ptm-slot-filter"
            options={classOptions}
            value={filter}
            onChange={(next) => {
              setFilter(next);
              void load(next);
            }}
            required={false}
          />
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFilter(emptyClassSelection);
                void load(emptyClassSelection);
              }}
            >
              Clear filter
            </Button>
          </div>
        </div>

        {loading ? (
          <ErpLoading label="Loading slots…" />
        ) : (
          <RecordTable
            rows={slots}
            columns={columns}
            getRowKey={(row) => row.id}
            searchPlaceholder="Search slots…"
            exportFilename="ptm-time-slots"
            exportTitle="PTM time slots"
            emptyTitle="No PTM time slots defined."
            emptyHint="Add a slot above so parents can book a meeting."
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
