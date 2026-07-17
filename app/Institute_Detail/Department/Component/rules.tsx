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
  ShieldCheck,
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

export type RuleStatus = "Active" | "Draft";
export type RuleCategory = "Leave" | "Attendance" | "Approval" | "Finance" | "Security";

export interface Rule {
  id: string;
  name: string;
  code: string;
  category: RuleCategory;
  status: RuleStatus;
  lastUpdated: string;
  updatedBy: string;
  description?: string;
}

type RuleView = "list" | "add" | "edit" | "view";

const CURRENT_USER = "You";

const ruleCategories: RuleCategory[] = [
  "Leave",
  "Attendance",
  "Approval",
  "Finance",
  "Security",
];

const initialRules: Rule[] = [
  {
    id: "rul-1",
    name: "Leave Approval Threshold",
    code: "RUL-LAT-001",
    category: "Leave",
    status: "Active",
    lastUpdated: "03 Jun 2025",
    updatedBy: "Meera Iyer",
    description:
      "Leaves up to 3 days are auto-approved by the reporting manager.",
  },
  {
    id: "rul-2",
    name: "Overtime Cap",
    code: "RUL-OTC-002",
    category: "Attendance",
    status: "Active",
    lastUpdated: "21 May 2025",
    updatedBy: "Rahul Verma",
    description:
      "Weekly overtime is capped at 10 hours without director approval.",
  },
  {
    id: "rul-3",
    name: "Expense Auto-Approve",
    code: "RUL-EXP-003",
    category: "Finance",
    status: "Draft",
    lastUpdated: "09 Jun 2025",
    updatedBy: "Kabir Khan",
    description:
      "Expenses below Rs. 2,000 are auto-approved for verified vendors.",
  },
  {
    id: "rul-4",
    name: "Remote Check-in Window",
    code: "RUL-RCW-004",
    category: "Attendance",
    status: "Active",
    lastUpdated: "28 May 2025",
    updatedBy: "Priya Nair",
    description: "Remote check-in is allowed between 08:00 and 11:00 IST.",
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
  return `rul-${Date.now()}`;
}

function StatusBadge({ status }: { status: RuleStatus }) {
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

function CategoryBadge({ category }: { category: RuleCategory }) {
  return (
    <span className="inline-flex h-[20px] items-center rounded-full border border-[#dce5ef] bg-[#f8fbff] px-2 text-[11px] font-medium leading-none text-[#405275]">
      {category}
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

function RuleCard({
  rule,
  onView,
  onEdit,
  onDuplicate,
  onDelete,
  menuRef,
  menuOpen,
  onToggleMenu,
}: {
  rule: Rule;
  onView: (rule: Rule) => void;
  onEdit: (rule: Rule) => void;
  onDuplicate: (rule: Rule) => void;
  onDelete: (rule: Rule) => void;
  menuRef: (el: HTMLDivElement | null) => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
}) {
  return (
    <div className="rounded-xl border border-[#dce5ef] bg-white p-4 shadow-[0_1px_4px_rgba(15,23,42,0.12)]">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#eef3ff] text-[#2563eb]">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[13px] font-semibold leading-5 text-[#061632]">
              {rule.name}
            </h3>
            <StatusBadge status={rule.status} />
            <CategoryBadge category={rule.category} />
          </div>
          <p className="mt-1 font-mono text-[11px] text-[#405275]">
            {rule.code}
          </p>
        </div>
        <div ref={menuRef} className="relative shrink-0">
          <IconButton
            label={`More options for ${rule.name}`}
            icon={<MoreVertical className="h-4 w-4" />}
            onClick={onToggleMenu}
          />
          {menuOpen ? (
            <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-[#dce5ef] bg-white p-1 text-[#061632] shadow-lg">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-[#f3f7fc]"
                onClick={() => onView(rule)}
              >
                <Eye className="h-4 w-4" />
                View rule
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-[#f3f7fc]"
                onClick={() => onEdit(rule)}
              >
                <Pencil className="h-4 w-4" />
                Edit rule
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-[#f3f7fc]"
                onClick={() => onDuplicate(rule)}
              >
                <Copy className="h-4 w-4" />
                Duplicate
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-red-600 hover:bg-red-50"
                onClick={() => onDelete(rule)}
              >
                <Trash2 className="h-4 w-4" />
                Delete rule
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 space-y-1 text-[11px] leading-4 text-[#52657d]">
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          Last updated {rule.lastUpdated}
        </span>
        <span className="flex items-center gap-1.5">
          <User className="h-3.5 w-3.5" />
          Updated by {rule.updatedBy}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#dce5ef] pt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 border-[#dce5ef] bg-[#f9fbfe] text-[12px] font-semibold text-[#061632] shadow-sm"
          onClick={() => onView(rule)}
        >
          <Eye className="h-4 w-4" aria-hidden="true" />
          View
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 border-[#dce5ef] bg-[#f9fbfe] text-[12px] font-semibold text-[#061632] shadow-sm"
          onClick={() => onEdit(rule)}
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Edit
        </Button>
      </div>
    </div>
  );
}

function RuleForm({
  rule,
  onSubmit,
  onCancel,
}: {
  rule?: Rule;
  onSubmit: (rule: Rule) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(rule?.name ?? "");
  const [code, setCode] = useState(rule?.code ?? "");
  const [category, setCategory] = useState<RuleCategory>(
    rule?.category ?? "Leave"
  );
  const [status, setStatus] = useState<RuleStatus>(rule?.status ?? "Draft");
  const [description, setDescription] = useState(rule?.description ?? "");

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;

    onSubmit({
      id: rule?.id ?? createId(),
      name: name.trim(),
      code: (code.trim() || "RUL-NEW").toUpperCase(),
      category,
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
          htmlFor="rule-name"
          className="text-[13px] font-semibold text-[#061632]"
        >
          Rule Name
        </label>
        <Input
          id="rule-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Leave Approval Threshold"
          className="h-10 rounded-xl border-[#d7e0eb] bg-white text-[13px]"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="rule-code"
          className="text-[13px] font-semibold text-[#061632]"
        >
          Rule Code
        </label>
        <Input
          id="rule-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="e.g. RUL-LAT-001"
          className="h-10 rounded-xl border-[#d7e0eb] bg-white font-mono text-[13px]"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label
            htmlFor="rule-category"
            className="text-[13px] font-semibold text-[#061632]"
          >
            Category
          </label>
          <Select
            value={category}
            onValueChange={(value) => setCategory(value as RuleCategory)}
          >
            <SelectTrigger
              id="rule-category"
              className="h-10 rounded-xl border-[#d7e0eb] bg-white text-[13px]"
            >
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {ruleCategories.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="rule-status"
            className="text-[13px] font-semibold text-[#061632]"
          >
            Status
          </label>
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as RuleStatus)}
          >
            <SelectTrigger
              id="rule-status"
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
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="rule-description"
          className="text-[13px] font-semibold text-[#061632]"
        >
          Rule Logic / Description
        </label>
        <Textarea
          id="rule-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Describe the rule logic"
          rows={4}
          className="min-h-[78px] rounded-xl border-[#d7e0eb] bg-white text-[13px] leading-5"
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim()}>
          {rule ? "Save Changes" : "Create Rule"}
        </Button>
      </div>
    </form>
  );
}

function RuleDetail({
  rule,
  onEdit,
  onBack,
}: {
  rule: Rule;
  onEdit: (rule: Rule) => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#eef3ff] text-[#2563eb]">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[13px] font-semibold text-[#061632]">
              {rule.name}
            </h3>
            <StatusBadge status={rule.status} />
            <CategoryBadge category={rule.category} />
          </div>
          <p className="mt-1 font-mono text-[11px] text-[#405275]">
            {rule.code}
          </p>
        </div>
      </div>

      <dl className="space-y-3 rounded-lg border border-[#dce5ef] bg-[#f8fbff] p-4">
        <div className="flex items-center justify-between gap-4 text-[12px]">
          <dt className="text-[#52657d]">Category</dt>
          <dd className="font-semibold text-[#061632]">{rule.category}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 text-[12px]">
          <dt className="text-[#52657d]">Status</dt>
          <dd className="font-semibold text-[#061632]">{rule.status}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 text-[12px]">
          <dt className="text-[#52657d]">Last updated</dt>
          <dd className="font-semibold text-[#061632]">{rule.lastUpdated}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 text-[12px]">
          <dt className="text-[#52657d]">Updated by</dt>
          <dd className="font-semibold text-[#061632]">{rule.updatedBy}</dd>
        </div>
      </dl>

      {rule.description ? (
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-[#061632]">
            Rule Logic
          </p>
          <p className="text-[13px] leading-6 text-[#405275]">
            {rule.description}
          </p>
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="button" onClick={() => onEdit(rule)}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Edit Rule
        </Button>
      </div>
    </div>
  );
}

export default function RulesModule() {
  const [rules, setRules] = useState<Rule[]>(initialRules);
  const [view, setView] = useState<RuleView>("list");
  const [selected, setSelected] = useState<Rule | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Rule | null>(null);
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

  const handleAdd = (rule: Rule) => {
    setRules((current) => [rule, ...current]);
    goToList();
  };

  const handleUpdate = (updated: Rule) => {
    setRules((current) =>
      current.map((rule) => (rule.id === updated.id ? updated : rule))
    );
    goToList();
  };

  const handleDuplicate = (rule: Rule) => {
    const copy: Rule = {
      ...rule,
      id: createId(),
      name: `${rule.name} (Copy)`,
      status: "Draft",
      lastUpdated: formatToday(),
      updatedBy: CURRENT_USER,
    };
    setRules((current) => [copy, ...current]);
    setOpenMenu(null);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;

    setRules((current) =>
      current.filter((rule) => rule.id !== pendingDelete.id)
    );
    setPendingDelete(null);
  };

  if (view === "add" || view === "edit") {
    const isEdit = view === "edit";

    return (
      <div className="min-h-0 overflow-y-auto">
        <div className="mb-4 flex items-center gap-2">
          <IconButton
            label="Back to rules"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={goToList}
          />
          <div>
            <h3 className="text-base font-semibold leading-5 text-[#061632]">
              {isEdit ? "Edit Rule" : "Add Rule"}
            </h3>
            <p className="mt-0.5 text-[11px] text-[#405275]">
              {isEdit
                ? "Update the details for this decision rule."
                : "Create a new decision rule for Talent Acquisition."}
            </p>
          </div>
        </div>
        <RuleForm
          rule={isEdit ? selected ?? undefined : undefined}
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
            label="Back to rules"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={goToList}
          />
          <h3 className="text-base font-semibold text-[#061632]">
            Rule Details
          </h3>
        </div>
        <RuleDetail
          rule={selected}
          onEdit={(rule) => {
            setSelected(rule);
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
          Rules ({rules.length})
        </h3>
        <Button
          type="button"
          size="lg"
          className="h-10 shrink-0 px-3 text-[12px]"
          onClick={() => setView("add")}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Rule
        </Button>
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
        {rules.map((rule) => (
          <RuleCard
            key={rule.id}
            rule={rule}
            onView={(rule) => {
              setSelected(rule);
              setView("view");
            }}
            onEdit={(rule) => {
              setSelected(rule);
              setView("edit");
            }}
            onDuplicate={handleDuplicate}
            onDelete={(rule) => {
              setOpenMenu(null);
              setPendingDelete(rule);
            }}
            menuRef={(el) => {
              menuRefs.current[rule.id] = el;
            }}
            menuOpen={openMenu === rule.id}
            onToggleMenu={() =>
              setOpenMenu((current) => (current === rule.id ? null : rule.id))
            }
          />
        ))}
      </div>
    </div>
  );
}
