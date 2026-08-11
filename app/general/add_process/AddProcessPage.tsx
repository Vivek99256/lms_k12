"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { FileText, GitBranchPlus, LoaderCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ErpAlert,
  ErpLoading,
  ErpPageHeader,
  ErpSection,
  erpSelectClass,
} from "@/components/erp/erp-ui";
import { RecordTable, type RecordColumn } from "@/components/erp/RecordTable";
import { errorMessage } from "@/lib/erp-legacy";
import {
  createAddProcess,
  deleteAddProcess,
  loadAddProcessBoard,
  loadAddProcessById,
  updateAddProcess,
  type AddProcessBoard,
  type AddProcessInput,
  type AddProcessMenuOption,
  type AddProcessRecord,
} from "./api";

const emptyBoard: AddProcessBoard = {
  records: [],
  menuOptions: [],
};

function emptyInput(): AddProcessInput {
  return {
    menuDetails: "",
    requirements: "",
  };
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function previewText(value: string): string {
  const plain = stripHtml(value);
  if (!plain) return "";
  return plain.length > 180 ? `${plain.slice(0, 177)}...` : plain;
}

export function AddProcessPage() {
  const [board, setBoard] = useState<AddProcessBoard>(emptyBoard);
  const [input, setInput] = useState<AddProcessInput>(emptyInput);
  const [editing, setEditing] = useState<AddProcessRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setBoard(await loadAddProcessBoard());
    } catch (value: unknown) {
      setError(errorMessage(value, "Add Process data could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // The Laravel proxy depends on the browser session context from localStorage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const selectedOption = useMemo<AddProcessMenuOption | undefined>(
    () => board.menuOptions.find((option) => option.menuDetails === input.menuDetails),
    [board.menuOptions, input.menuDetails]
  );

  function resetForm() {
    setInput(emptyInput());
    setEditing(null);
  }

  function validate(): string {
    if (!editing && !input.menuDetails) return "Menu name is required.";
    if (!stripHtml(input.requirements)) return "Process is required.";
    return "";
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    const validation = validate();
    if (validation) {
      setError(validation);
      return;
    }

    setSaving(true);
    try {
      const message = editing
        ? await updateAddProcess(editing.id, { requirements: input.requirements })
        : await createAddProcess(input);
      setNotice(message);
      resetForm();
      await load();
    } catch (value: unknown) {
      setError(errorMessage(value, "The process could not be saved."));
    } finally {
      setSaving(false);
    }
  }

  async function startEdit(record: AddProcessRecord) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const latest = await loadAddProcessById(record.id);
      setEditing(latest);
      setInput({
        menuDetails: latest.menuId && latest.menuName ? `${latest.menuId}/${latest.menuName}` : "",
        requirements: latest.requirements,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (value: unknown) {
      setError(errorMessage(value, "The selected process could not be opened."));
    } finally {
      setSaving(false);
    }
  }

  async function remove(record: AddProcessRecord) {
    setError("");
    setNotice("");
    if (!window.confirm(`Delete the process for ${record.menuName}?`)) return;

    setDeletingId(record.id);
    try {
      setNotice(await deleteAddProcess(record.id));
      if (editing?.id === record.id) {
        resetForm();
      }
      await load();
    } catch (value: unknown) {
      setError(errorMessage(value, "The process could not be deleted."));
    } finally {
      setDeletingId(null);
    }
  }

  const columns: Array<RecordColumn<AddProcessRecord>> = [
    {
      key: "menu_name",
      label: "Menu Name",
      value: (row) => row.menuName,
    },
    {
      key: "requirements",
      label: "Process",
      value: (row) => stripHtml(row.requirements),
      render: (row) => (
        <div className="max-w-3xl whitespace-normal text-sm leading-6 text-slate-700">
          {previewText(row.requirements) || "—"}
        </div>
      ),
    },
    {
      key: "created_by_name",
      label: "Created By",
      value: (row) => row.createdByName,
    },
  ];

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <ErpPageHeader
        title="Add Process"
        description="Maintain the TRIZ process entries used by the legacy requirements module."
        onRefresh={() => void load()}
        refreshing={loading || saving || deletingId !== null}
      />

      <ErpAlert tone="error">{error}</ErpAlert>
      <ErpAlert tone="success">{notice}</ErpAlert>

      <form onSubmit={submit}>
        <ErpSection
          title={editing ? `Edit Process - ${editing.menuName}` : "Add New Process"}
          description={
            editing
              ? "The menu name is locked during edit, matching the Laravel screen."
              : "Choose a menu and enter the process content."
          }
          icon={<GitBranchPlus className="size-5" />}
          footer={
            <>
              {editing ? (
                <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
                  Cancel
                </Button>
              ) : null}
              <Button type="submit" disabled={saving || loading}>
                {saving ? <LoaderCircle className="size-4 animate-spin" /> : null}
                {editing ? "Update Process" : "Save Process"}
              </Button>
            </>
          }
        >
          {loading ? (
            <ErpLoading label="Loading process form..." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="menuDetails">Menu Name *</Label>
                <select
                  id="menuDetails"
                  className={erpSelectClass}
                  value={input.menuDetails}
                  disabled={Boolean(editing) || saving}
                  onChange={(event) =>
                    setInput((current) => ({ ...current, menuDetails: event.target.value }))
                  }
                  required={!editing}
                >
                  <option value="">Select Menu</option>
                  {board.menuOptions.map((option) => (
                    <option key={option.id} value={option.menuDetails}>
                      {option.menuTitle}
                    </option>
                  ))}
                </select>
                {selectedOption ? (
                  <p className="text-xs text-slate-500">Selected menu id: {selectedOption.id}</p>
                ) : null}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="requirements">Process *</Label>
                <Textarea
                  id="requirements"
                  rows={10}
                  value={input.requirements}
                  onChange={(event) =>
                    setInput((current) => ({ ...current, requirements: event.target.value }))
                  }
                  placeholder="Enter the TRIZ process details"
                  className="min-h-[220px] resize-y"
                  required
                />
                <p className="text-xs text-slate-500">
                  The legacy Blade page used CKEditor; this page preserves the same stored HTML/text
                  value through the existing Laravel endpoint.
                </p>
              </div>
            </div>
          )}
        </ErpSection>
      </form>

      <ErpSection
        title="Process List"
        description="Includes the same list columns and actions as the old Laravel table."
        icon={<FileText className="size-5" />}
      >
        {loading ? (
          <ErpLoading label="Loading processes..." />
        ) : (
          <RecordTable
            rows={board.records}
            columns={columns}
            getRowKey={(row) => row.id}
            searchPlaceholder="Search processes..."
            exportFilename="add-process"
            exportTitle="Add Process"
            emptyTitle="No process records found."
            emptyHint="Use the form above to create the first TRIZ process."
            actions={(row) => (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving || deletingId !== null}
                  onClick={() => void startEdit(row)}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={saving || deletingId === row.id}
                  onClick={() => void remove(row)}
                >
                  {deletingId === row.id ? (
                    <LoaderCircle className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                </Button>
              </div>
            )}
          />
        )}
      </ErpSection>
    </main>
  );
}
