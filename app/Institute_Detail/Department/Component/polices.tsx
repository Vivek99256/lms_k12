"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Clock,
  Copy,
  Eye,
  MoreVertical,
  Pencil,
  Plus,
  ScrollText,
  Sparkles,
  Trash2,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import AiGenerationDrawer from "./ai-generation-drawer";
import type { AiGeneratedDocumentSave } from "./ai-generation-drawer";

export type PolicyStatus = "Active" | "Draft";

export interface Policy {
  id: string;
  name: string;
  code: string;
  status: PolicyStatus;
  lastUpdated: string;
  updatedBy: string;
  description?: string;
}

type PolicyView = "list" | "add" | "edit" | "view";

const CURRENT_USER = "You";

const initialPolicies: Policy[] = [
  {
    id: "pol-1",
    name: "Code of Conduct",
    code: "HR-COD-001",
    status: "Active",
    lastUpdated: "09 Jun 2025",
    updatedBy: "Sanjay Kapoor",
    description: "Defines the expected standards of behaviour for all employees.",
  },
  {
    id: "pol-2",
    name: "Data Privacy & Retention",
    code: "SEC-DSP-002",
    status: "Active",
    lastUpdated: "15 May 2025",
    updatedBy: "Kabir Khan",
    description: "Governs the collection, storage and disposal of personal data.",
  },
  {
    id: "pol-3",
    name: "Remote Work & Connectivity",
    code: "ENG-RWP-003",
    status: "Draft",
    lastUpdated: "02 Jun 2025",
    updatedBy: "Rahul Verma",
    description: "Outlines eligibility and expectations for remote work arrangements.",
  },
  {
    id: "pol-4",
    name: "Leave & Attendance",
    code: "HR-LAP-004",
    status: "Active",
    lastUpdated: "28 May 2025",
    updatedBy: "Priya Nair",
    description: "Covers leave entitlements, accrual and attendance tracking.",
  },
];

function formatToday() {
  return new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function createId() {
  return `pol-${Date.now()}`;
}

function createPolicyCode(category: string) {
  const prefix = category
    .replace(/[^a-z]/gi, "")
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, "POL");

  return `${prefix}-AI-${Date.now().toString().slice(-3)}`;
}

function StatusBadge({ status }: { status: PolicyStatus }) {
  const classes =
    status === "Active"
      ? "border-emerald-200 bg-emerald-50 text-emerald-600"
      : "border-amber-200 bg-amber-50 text-amber-600";

  return (
    <span
      className={`inline-flex h-[20px] items-center rounded-full border px-2 text-[11px] font-medium leading-none ${classes}`}
    >
      {status}
    </span>
  );
}

function IconButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-md text-[#061632] transition-colors hover:bg-[#f3f7fc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ab3f5]"
    >
      {icon}
    </button>
  );
}

function PolicyCard({
  policy,
  onView,
  onEdit,
  onDuplicate,
  onDelete,
  menuRef,
  menuOpen,
  onToggleMenu,
}: {
  policy: Policy;
  onView: (policy: Policy) => void;
  onEdit: (policy: Policy) => void;
  onDuplicate: (policy: Policy) => void;
  onDelete: (policy: Policy) => void;
  menuRef: (el: HTMLDivElement | null) => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
}) {
  return (
    <div className="rounded-xl border border-[#dce5ef] bg-white p-4 shadow-[0_1px_4px_rgba(15,23,42,0.12)]">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#eef3ff] text-[#2563eb]">
          <ScrollText className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[13px] font-semibold leading-5 text-[#061632]">
              {policy.name}
            </h3>
            <StatusBadge status={policy.status} />
          </div>
          <p className="mt-1 font-mono text-[11px] text-[#405275]">
            {policy.code}
          </p>
        </div>
        <div ref={menuRef} className="relative shrink-0">
          <IconButton
            label={`More options for ${policy.name}`}
            icon={<MoreVertical className="h-4 w-4" />}
            onClick={onToggleMenu}
          />
          {menuOpen ? (
            <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-[#dce5ef] bg-white p-1 text-[#061632] shadow-lg">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-[#f3f7fc]"
                onClick={() => onView(policy)}
              >
                <Eye className="h-4 w-4" />
                View policy
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-[#f3f7fc]"
                onClick={() => onEdit(policy)}
              >
                <Pencil className="h-4 w-4" />
                Edit policy
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-[#f3f7fc]"
                onClick={() => onDuplicate(policy)}
              >
                <Copy className="h-4 w-4" />
                Duplicate
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-red-600 hover:bg-red-50"
                onClick={() => onDelete(policy)}
              >
                <Trash2 className="h-4 w-4" />
                Delete policy
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 space-y-1 text-[11px] leading-4 text-[#52657d]">
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          Last updated {policy.lastUpdated}
        </span>
        <span className="flex items-center gap-1.5">
          <User className="h-3.5 w-3.5" />
          Updated by {policy.updatedBy}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#dce5ef] pt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 border-[#dce5ef] bg-[#f9fbfe] text-[12px] font-semibold text-[#061632] shadow-sm"
          onClick={() => onView(policy)}
        >
          <Eye className="h-4 w-4" aria-hidden="true" />
          View
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 border-[#dce5ef] bg-[#f9fbfe] text-[12px] font-semibold text-[#061632] shadow-sm"
          onClick={() => onEdit(policy)}
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Edit
        </Button>
      </div>
    </div>
  );
}

function PolicyForm({
  policy,
  onSubmit,
  onCancel,
}: {
  policy?: Policy;
  onSubmit: (policy: Policy) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(policy?.name ?? "");
  const [code, setCode] = useState(policy?.code ?? "");
  const [status, setStatus] = useState<PolicyStatus>(policy?.status ?? "Draft");
  const [description, setDescription] = useState(policy?.description ?? "");

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;

    onSubmit({
      id: policy?.id ?? createId(),
      name: name.trim(),
      code: (code.trim() || "POL-NEW").toUpperCase(),
      status,
      lastUpdated: formatToday(),
      updatedBy: CURRENT_USER,
      description: description.trim(),
    });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1.5">
        <label
          htmlFor="policy-name"
          className="text-[13px] font-semibold text-[#061632]"
        >
          Policy Name
        </label>
        <Input
          id="policy-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Code of Conduct"
          className="h-10 rounded-xl border-[#d7e0eb] bg-white text-[13px]"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="policy-code"
          className="text-[13px] font-semibold text-[#061632]"
        >
          Policy Code
        </label>
        <Input
          id="policy-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="e.g. HR-COD-001"
          className="h-10 rounded-xl border-[#d7e0eb] bg-white font-mono text-[13px]"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="policy-status"
          className="text-[13px] font-semibold text-[#061632]"
        >
          Status
        </label>
        <Select
          value={status}
          onValueChange={(value) => setStatus(value as PolicyStatus)}
        >
          <SelectTrigger
            id="policy-status"
            className="h-10 rounded-xl border-[#d7e0eb] bg-white text-[13px]"
          >
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Draft">Draft</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="policy-description"
          className="text-[13px] font-semibold text-[#061632]"
        >
          Description
        </label>
        <Textarea
          id="policy-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Brief summary of this policy"
          rows={4}
          className="min-h-[78px] rounded-xl border-[#d7e0eb] bg-white text-[13px] leading-5"
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim()}>
          {policy ? "Save Changes" : "Create Policy"}
        </Button>
      </div>
    </form>
  );
}

function PolicyDetail({
  policy,
  onEdit,
  onBack,
}: {
  policy: Policy;
  onEdit: (policy: Policy) => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#eef3ff] text-[#2563eb]">
          <ScrollText className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[13px] font-semibold text-[#061632]">
              {policy.name}
            </h3>
            <StatusBadge status={policy.status} />
          </div>
          <p className="mt-1 font-mono text-[11px] text-[#405275]">
            {policy.code}
          </p>
        </div>
      </div>

      <dl className="space-y-3 rounded-lg border border-[#dce5ef] bg-[#f8fbff] p-4">
        <div className="flex items-center justify-between gap-4 text-[12px]">
          <dt className="text-[#52657d]">Status</dt>
          <dd className="font-semibold text-[#061632]">{policy.status}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 text-[12px]">
          <dt className="text-[#52657d]">Last updated</dt>
          <dd className="font-semibold text-[#061632]">{policy.lastUpdated}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 text-[12px]">
          <dt className="text-[#52657d]">Updated by</dt>
          <dd className="font-semibold text-[#061632]">{policy.updatedBy}</dd>
        </div>
      </dl>

      {policy.description ? (
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-[#061632]">
            Description
          </p>
          <p className="text-[13px] leading-6 text-[#405275]">
            {policy.description}
          </p>
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="button" onClick={() => onEdit(policy)}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Edit Policy
        </Button>
      </div>
    </div>
  );
}

export default function PoliciesModule({ departmentName }: { departmentName?: string }) {
  const [policies, setPolicies] = useState<Policy[]>(initialPolicies);
  const [view, setView] = useState<PolicyView>("list");
  const [selected, setSelected] = useState<Policy | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Policy | null>(null);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!openMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRefs.current[openMenu]?.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenu]);

  const goToList = () => {
    setView("list");
    setSelected(null);
    setPendingDelete(null);
    setOpenMenu(null);
  };

  const handleAdd = (policy: Policy) => {
    setPolicies((current) => [policy, ...current]);
    goToList();
  };

  const handleAiSave = (document: AiGeneratedDocumentSave) => {
    const policy: Policy = {
      id: createId(),
      name: document.title,
      code: createPolicyCode(document.category),
      status: document.status,
      lastUpdated: formatToday(),
      updatedBy: CURRENT_USER,
      description: document.description,
    };

    setPolicies((current) => [policy, ...current]);
    goToList();
  };

  const handleUpdate = (updated: Policy) => {
    setPolicies((current) =>
      current.map((policy) => (policy.id === updated.id ? updated : policy))
    );
    goToList();
  };

  const handleDuplicate = (policy: Policy) => {
    const copy: Policy = {
      ...policy,
      id: createId(),
      name: `${policy.name} (Copy)`,
      status: "Draft",
      lastUpdated: formatToday(),
      updatedBy: CURRENT_USER,
    };
    setPolicies((current) => [copy, ...current]);
    setOpenMenu(null);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;

    setPolicies((current) =>
      current.filter((policy) => policy.id !== pendingDelete.id)
    );
    setPendingDelete(null);
  };

  if (view === "add" || view === "edit") {
    const isEdit = view === "edit";

    return (
      <div className="min-h-0 overflow-y-auto">
        <div className="mb-4 flex items-center gap-2">
          <IconButton
            label="Back to policies"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={goToList}
          />
          <div>
            <h3 className="text-base font-semibold leading-5 text-[#061632]">
              {isEdit ? "Edit Policy" : "Add Policy"}
            </h3>
            <p className="mt-0.5 text-[11px] text-[#405275]">
              {isEdit
                ? "Update the details for this policy."
                : "Create a new policy for Talent Acquisition."}
            </p>
          </div>
        </div>
        <PolicyForm
          policy={isEdit ? selected ?? undefined : undefined}
          onSubmit={isEdit ? handleUpdate : handleAdd}
          onCancel={goToList}
        />
      </div>
    );
  }

  if (view === "view" && selected) {
    return (
      <div className="min-h-0 overflow-y-auto">
        <div className="mb-4 flex items-center gap-2">
          <IconButton
            label="Back to policies"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={goToList}
          />
          <h3 className="text-base font-semibold text-[#061632]">
            Policy Details
          </h3>
        </div>
        <PolicyDetail
          policy={selected}
          onEdit={(policy) => {
            setSelected(policy);
            setView("edit");
          }}
          onBack={goToList}
        />
      </div>
    );
  }

  return (
    <div className="min-h-0 overflow-y-auto">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-[#061632]">
          Policies ({policies.length})
        </h3>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            size="lg"
            className="h-10 px-3 text-[12px]"
            onClick={() => setView("add")}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Policy
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-10 border-[#d7e0eb] bg-white px-3 text-[12px] font-semibold text-[#6d28d9] hover:bg-[#f5efff]"
            onClick={() => setAiDrawerOpen(true)}
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            AI Generate
          </Button>
        </div>
      </div>

      {pendingDelete ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-[13px] leading-5 text-[#061632]">
            Delete <span className="font-semibold">{pendingDelete.name}</span>?
            This action cannot be undone.
          </p>
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPendingDelete(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={confirmDelete}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Delete
            </Button>
          </div>
        </div>
      ) : null}

      <div className="space-y-4 pb-1">
        {policies.map((policy) => (
          <PolicyCard
            key={policy.id}
            policy={policy}
            onView={(policy) => {
              setSelected(policy);
              setView("view");
            }}
            onEdit={(policy) => {
              setSelected(policy);
              setView("edit");
            }}
            onDuplicate={handleDuplicate}
            onDelete={(policy) => {
              setOpenMenu(null);
              setPendingDelete(policy);
            }}
            menuRef={(el) => {
              menuRefs.current[policy.id] = el;
            }}
            menuOpen={openMenu === policy.id}
            onToggleMenu={() =>
              setOpenMenu((current) =>
                current === policy.id ? null : policy.id
              )
            }
          />
        ))}
      </div>

      <AiGenerationDrawer
        open={aiDrawerOpen}
        kind="Policy"
        onClose={() => setAiDrawerOpen(false)}
        onSave={handleAiSave}
        departmentName={departmentName}
      />
    </div>
  );
}
