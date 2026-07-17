"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  ArrowLeft,
  Clock,
  Download,
  Eye,
  FileText,
  MoreVertical,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";

import { API_BASE_URL } from "@/app/components/utils/api_url";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import AiGenerationDrawer from "./ai-generation-drawer";
import type {
  AiGeneratedDocumentSave,
  AiGeneratedDocumentSavedResult,
} from "./ai-generation-drawer";

export type SopStatus = "Active" | "Draft" | "Archived";
export type SopView = "list" | "add" | "edit" | "view";

export interface Sop {
  id: string;
  title: string;
  version: string;
  type: string;
  status: SopStatus;
  uploadedBy: string;
  uploadedOn: string;
  pdfUrl?: string;
}

type ActivityEvent = {
  id: string;
  icon: ReactNode;
  user: string;
  text: string;
  date: string;
};

const CURRENT_USER = "You";

type SopSession = {
  baseUrl: string;
  token: string;
  subInstituteId: string;
  userId: string;
};

type StoreSopResponse = {
  status_code?: number | string;
  message?: string;
  data?: {
    id?: number | string;
    pdf_url?: string;
  };
  errors?: Record<string, string[]>;
};

function readString(value: unknown): string {
  return typeof value === "string"
    ? value
    : value == null
      ? ""
      : String(value);
}

function getSopSession(): SopSession {
  if (typeof window === "undefined") {
    return { baseUrl: API_BASE_URL, token: "", subInstituteId: "", userId: "" };
  }

  try {
    const userData = JSON.parse(
      localStorage.getItem("userData") || "{}"
    ) as Record<string, unknown>;
    const menuContext = JSON.parse(
      localStorage.getItem("menuContext") || "{}"
    ) as Record<string, unknown>;

    return {
      baseUrl: readString(userData.host_name) || API_BASE_URL,
      token: readString(
        userData.user_token ??
          userData.token ??
          menuContext.user_token ??
          menuContext.token
      ),
      subInstituteId: readString(
        userData.sub_institute_id ?? menuContext.sub_institute_id
      ),
      userId: readString(
        userData.user_id ??
          userData.id ??
          userData.user_profile_id ??
          menuContext.user_id ??
          menuContext.user_profile_id
      ),
    };
  } catch {
    return { baseUrl: API_BASE_URL, token: "", subInstituteId: "", userId: "" };
  }
}

function getApiErrorMessage(payload: StoreSopResponse | null, fallback: string): string {
  const errors = payload?.errors;
  if (errors) {
    const firstKey = Object.keys(errors)[0];
    const firstMessage = firstKey ? errors[firstKey]?.[0] : "";
    if (firstMessage) return firstMessage;
  }

  return payload?.message || fallback;
}

const initialSops: Sop[] = [
  {
    id: "sop-1",
    title: "Employee Onboarding Workflow",
    version: "v2.3",
    type: "PDF",
    status: "Active",
    uploadedBy: "Priya Nair",
    uploadedOn: "12 Jun 2025",
  },
  {
    id: "sop-2",
    title: "Incident Reporting & Escalation",
    version: "v1.1",
    type: "DOCX",
    status: "Active",
    uploadedBy: "Sanjay Kapoor",
    uploadedOn: "28 May 2025",
  },
  {
    id: "sop-3",
    title: "Quarterly Performance Review",
    version: "v3.0",
    type: "PDF",
    status: "Draft",
    uploadedBy: "Meera Iyer",
    uploadedOn: "15 May 2025",
  },
  {
    id: "sop-4",
    title: "Data Privacy & Retention",
    version: "v2.0",
    type: "DOCX",
    status: "Archived",
    uploadedBy: "Kabir Khan",
    uploadedOn: "19 Mar 2025",
  },
];


const recentActivity: ActivityEvent[] = [
  {
    id: "act-1",
    icon: <Upload className="h-3.5 w-3.5" />,
    user: "Priya Nair",
    text: "uploaded SOP Employee Onboarding Workflow",
    date: "12 Jun 2025",
  },
  {
    id: "act-2",
    icon: <Pencil className="h-3.5 w-3.5" />,
    user: "Sanjay Kapoor",
    text: "updated policy Code of Conduct",
    date: "09 Jun 2025",
  },
  {
    id: "act-3",
    icon: <ShieldCheck className="h-3.5 w-3.5" />,
    user: "Meera Iyer",
    text: "modified decision rule Leave Approval Threshold",
    date: "03 Jun 2025",
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
  return `sop-${Date.now()}`;
}

function getFileType(fileName: string) {
  const extension = fileName.split(".").pop()?.trim();
  return extension ? extension.toUpperCase() : "PDF";
}

function statusClass(status: SopStatus) {
  if (status === "Active") {
    return "border-emerald-200 bg-emerald-50 text-emerald-600";
  }

  if (status === "Draft") {
    return "border-amber-200 bg-amber-50 text-amber-600";
  }

  return "border-slate-300 bg-slate-50 text-slate-500";
}

function StatusBadge({ status }: { status: SopStatus }) {
  return (
    <span
      className={`inline-flex h-[20px] items-center rounded-full border px-2 text-[11px] font-medium leading-none ${statusClass(status)}`}
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


function RecentActivity() {
  return (
    <div className="space-y-3">
      <h4 className="flex items-center gap-2 text-[13px] font-semibold text-[#061632]">
        <Activity className="h-4 w-4" />
        Recent Activity
      </h4>
      <ul className="space-y-3">
        {recentActivity.map((event) => (
          <li key={event.id} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#eef3ff] text-[#2563eb]">
              {event.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-[12px] leading-5 text-[#405275]">
                <span className="font-semibold text-[#061632]">{event.user}</span>{" "}
                {event.text}
              </span>
              <span className="block text-[11px] text-[#52657d]">{event.date}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SopForm({
  sop,
  onSubmit,
  onCancel,
}: {
  sop?: Sop;
  onSubmit: (sop: Sop) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(sop?.title ?? "");
  const [version, setVersion] = useState(sop?.version ?? "");
  const [status, setStatus] = useState<SopStatus>(sop?.status ?? "Draft");
  const [fileName, setFileName] = useState("");

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;

    onSubmit({
      id: sop?.id ?? createId(),
      title: title.trim(),
      version: version.trim() || "v1.0",
      type: sop?.type ?? getFileType(fileName),
      status,
      uploadedBy: sop?.uploadedBy ?? CURRENT_USER,
      uploadedOn: sop?.uploadedOn ?? formatToday(),
    });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1.5">
        <label htmlFor="sop-title" className="text-[13px] font-semibold text-[#061632]">
          Document Title
        </label>
        <Input
          id="sop-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Employee Onboarding Workflow"
          className="h-10 rounded-xl border-[#d7e0eb] bg-white text-[13px]"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="sop-version" className="text-[13px] font-semibold text-[#061632]">
          Version
        </label>
        <Input
          id="sop-version"
          value={version}
          onChange={(event) => setVersion(event.target.value)}
          placeholder="e.g. v1.0"
          className="h-10 rounded-xl border-[#d7e0eb] bg-white text-[13px]"
        />
      </div>

      {!sop ? (
        <div className="space-y-1.5">
          <label htmlFor="sop-file" className="text-[13px] font-semibold text-[#061632]">
            Upload File
          </label>
          <label
            htmlFor="sop-file"
            className="flex h-10 cursor-pointer items-center justify-between gap-3 rounded-xl border border-[#d7e0eb] bg-white px-3 text-[13px] text-[#52657d] hover:bg-[#f8fbff]"
          >
            <span className="truncate">{fileName || "Choose a file"}</span>
            <Upload className="h-4 w-4 shrink-0 text-[#2563eb]" />
            <input
              id="sop-file"
              type="file"
              className="sr-only"
              onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
            />
          </label>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <label htmlFor="sop-status" className="text-[13px] font-semibold text-[#061632]">
          Status
        </label>
        <Select value={status} onValueChange={(value) => setStatus(value as SopStatus)}>
          <SelectTrigger
            id="sop-status"
            className="h-10 rounded-xl border-[#d7e0eb] bg-white text-[13px]"
          >
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Draft">Draft</SelectItem>
            <SelectItem value="Archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!title.trim()}>
          {sop ? "Save Changes" : "Upload SOP"}
        </Button>
      </div>
    </form>
  );
}

function SopDetail({
  sop,
  onBack,
  onEdit,
  onDownload,
}: {
  sop: Sop;
  onBack: () => void;
  onEdit: (sop: Sop) => void;
  onDownload: (sop: Sop) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#eef3ff] text-[#2563eb]">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[13px] font-semibold text-[#061632]">{sop.title}</h3>
            <StatusBadge status={sop.status} />
          </div>
          <p className="mt-1 font-mono text-[11px] text-[#405275]">
            {sop.version} / {sop.type}
          </p>
        </div>
      </div>

      <dl className="space-y-3 rounded-lg border border-[#dce5ef] bg-[#f8fbff] p-4">
        <div className="flex items-center justify-between gap-4 text-[12px]">
          <dt className="text-[#52657d]">Uploaded by</dt>
          <dd className="font-semibold text-[#061632]">{sop.uploadedBy}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 text-[12px]">
          <dt className="text-[#52657d]">Uploaded on</dt>
          <dd className="font-semibold text-[#061632]">{sop.uploadedOn}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 text-[12px]">
          <dt className="text-[#52657d]">Document type</dt>
          <dd className="font-semibold text-[#061632]">{sop.type}</dd>
        </div>
      </dl>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="button" variant="outline" onClick={() => onDownload(sop)}>
          <Download className="h-4 w-4" aria-hidden="true" />
          Download
        </Button>
        <Button type="button" onClick={() => onEdit(sop)}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Edit SOP
        </Button>
      </div>
    </div>
  );
}

function SopCard({
  sop,
  onView,
  onEdit,
  onDelete,
  onDownload,
  menuRef,
  menuOpen,
  onToggleMenu,
}: {
  sop: Sop;
  onView: (sop: Sop) => void;
  onEdit: (sop: Sop) => void;
  onDelete: (sop: Sop) => void;
  onDownload: (sop: Sop) => void;
  menuRef: (el: HTMLDivElement | null) => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
}) {
  return (
    <div className="rounded-xl border border-[#dce5ef] bg-white p-4 shadow-[0_1px_4px_rgba(15,23,42,0.12)]">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#eef3ff] text-[#2563eb]">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[13px] font-semibold leading-5 text-[#061632]">
              {sop.title}
            </h3>
            <Badge variant="outline" className="h-[20px] rounded-full px-2 text-[11px]">
              {sop.version}
            </Badge>
            <StatusBadge status={sop.status} />
          </div>
          <p className="mt-1 font-mono text-[11px] text-[#405275]">{sop.type}</p>
        </div>
        <div ref={menuRef} className="relative shrink-0">
          <IconButton
            label={`More options for ${sop.title}`}
            icon={<MoreVertical className="h-4 w-4" />}
            onClick={onToggleMenu}
          />
          {menuOpen ? (
            <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-[#dce5ef] bg-white p-1 text-[#061632] shadow-lg">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-[#f3f7fc]"
                onClick={() => onEdit(sop)}
              >
                <Pencil className="h-4 w-4" />
                Edit details
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-[#f3f7fc]"
              >
                <FileText className="h-4 w-4" />
                Move to folder
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-red-600 hover:bg-red-50"
                onClick={() => onDelete(sop)}
              >
                <Trash2 className="h-4 w-4" />
                Delete SOP
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 space-y-1 text-[11px] leading-4 text-[#52657d]">
        <span className="flex items-center gap-1.5">
          <User className="h-3.5 w-3.5" />
          Uploaded by {sop.uploadedBy}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          Uploaded on {sop.uploadedOn}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#dce5ef] pt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 border-[#dce5ef] bg-[#f9fbfe] text-[12px] font-semibold text-[#061632] shadow-sm"
          onClick={() => onView(sop)}
        >
          <Eye className="h-4 w-4" aria-hidden="true" />
          View
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 border-[#dce5ef] bg-[#f9fbfe] text-[12px] font-semibold text-[#061632] shadow-sm"
          onClick={() => onDownload(sop)}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Download
        </Button>
      </div>
    </div>
  );
}

function ViewAllDialog({
  sops,
  onClose,
  onView,
  onEdit,
  onDelete,
}: {
  sops: Sop[];
  onClose: () => void;
  onView: (sop: Sop) => void;
  onEdit: (sop: Sop) => void;
  onDelete: (sop: Sop) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-[#061632]/45 p-4">
      <div className="mx-auto flex h-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#dce5ef] px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-[#061632]">All SOPs</h3>
            <p className="mt-1 text-[12px] text-[#52657d]">
              View, edit, and delete standard operating procedures.
            </p>
          </div>
          <IconButton
            label="Close all SOPs"
            icon={<X className="h-4 w-4" />}
            onClick={onClose}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-5">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#f2f5f8] text-[11px]">
                <TableHead>Title</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uploaded By</TableHead>
                <TableHead>Uploaded On</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sops.map((sop) => (
                <TableRow key={sop.id} className="text-[12px]">
                  <TableCell className="font-semibold text-[#061632]">{sop.title}</TableCell>
                  <TableCell>{sop.version}</TableCell>
                  <TableCell>{sop.type}</TableCell>
                  <TableCell>
                    <StatusBadge status={sop.status} />
                  </TableCell>
                  <TableCell>{sop.uploadedBy}</TableCell>
                  <TableCell>{sop.uploadedOn}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <IconButton
                        label={`View ${sop.title}`}
                        icon={<Eye className="h-4 w-4" />}
                        onClick={() => onView(sop)}
                      />
                      <IconButton
                        label={`Edit ${sop.title}`}
                        icon={<Pencil className="h-4 w-4" />}
                        onClick={() => onEdit(sop)}
                      />
                      <IconButton
                        label={`Delete ${sop.title}`}
                        icon={<Trash2 className="h-4 w-4" />}
                        onClick={() => onDelete(sop)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {sops.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-[12px] text-[#52657d]">
                    No SOPs found.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

export default function SopsModule({
  departmentName,
  departmentId,
}: {
  departmentName?: string;
  departmentId?: string | number;
}) {
  const [sops, setSops] = useState<Sop[]>(initialSops);
  const [view, setView] = useState<SopView>("list");
  const [selected, setSelected] = useState<Sop | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Sop | null>(null);
  const [viewAllOpen, setViewAllOpen] = useState(false);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
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

  const handleAdd = (sop: Sop) => {
    setSops((current) => [sop, ...current]);
    goToList();
  };

  const storePublishedSop = async (
    document: AiGeneratedDocumentSave
  ): Promise<AiGeneratedDocumentSavedResult> => {
    const session = getSopSession();
    const selectedDepartmentId = readString(departmentId).trim();

    if (!selectedDepartmentId) {
      throw new Error("Department ID is missing. Please select a department and try again.");
    }

    if (!session.subInstituteId) {
      throw new Error("SubInstitute ID is missing. Please sign in again and try again.");
    }

    const baseUrl = session.baseUrl.replace(/\/$/, "");
    const headers: HeadersInit = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    if (session.token) {
      headers.Authorization = `Bearer ${session.token}`;
    }

    const response = await fetch(`${baseUrl}/api/ai-sop/store`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        sop_name: document.title,
        department_id: selectedDepartmentId,
        sop_content: document.description,
        sub_institute_id: session.subInstituteId,
        created_by: session.userId || undefined,
        updated_by: session.userId || undefined,
        status: document.status,
      }),
    });

    const payload = (await response.json().catch(() => null)) as StoreSopResponse | null;

    if (!response.ok || !payload || String(payload.status_code ?? "0") !== "1") {
      throw new Error(getApiErrorMessage(payload, "Unable to publish SOP. Please try again."));
    }

    return {
      id: payload.data?.id,
      pdfUrl: payload.data?.pdf_url,
    };
  };

  const handleAiSave = async (
    document: AiGeneratedDocumentSave
  ): Promise<AiGeneratedDocumentSavedResult | void> => {
    let savedResult: AiGeneratedDocumentSavedResult | undefined;

    if (document.status === "Active") {
      savedResult = await storePublishedSop(document);
    }

    const sop: Sop = {
      id: savedResult?.id ? String(savedResult.id) : createId(),
      title: document.title,
      version: "v1.0",
      type: document.status === "Active" ? "PDF" : "AI",
      status: document.status,
      uploadedBy: CURRENT_USER,
      uploadedOn: formatToday(),
      pdfUrl: savedResult?.pdfUrl,
    };

    setSops((current) => [sop, ...current]);
    setFeedback({
      kind: "success",
      message:
        document.status === "Active"
          ? "SOP published successfully. PDF generated and saved."
          : "SOP saved as draft.",
    });
    goToList();
    return savedResult;
  };

  const handleUpdate = (updated: Sop) => {
    setSops((current) => current.map((sop) => (sop.id === updated.id ? updated : sop)));
    goToList();
  };

  const handleDownload = (sop: Sop) => {
    if (sop.pdfUrl) {
      const link = document.createElement("a");
      link.href = sop.pdfUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    const content = [
      `SOP Title: ${sop.title}`,
      `Version: ${sop.version}`,
      `Status: ${sop.status}`,
      `Type: ${sop.type}`,
      `Uploaded By: ${sop.uploadedBy}`,
      `Uploaded On: ${sop.uploadedOn}`,
      "",
      "This mock document is ready to be replaced by GET /sops/:id/download.",
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sop.title.replace(/[^a-z0-9]/gi, "_")}_${sop.version}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;

    setSops((current) => current.filter((sop) => sop.id !== pendingDelete.id));
    setPendingDelete(null);
  };

  if (view === "add" || view === "edit") {
    const isEdit = view === "edit";

    return (
      <div className="min-h-0 overflow-y-auto">
        <div className="mb-4 flex items-center gap-2">
          <IconButton
            label="Back to SOPs"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={goToList}
          />
          <div>
            <h3 className="text-base font-semibold leading-5 text-[#061632]">
              {isEdit ? "Edit SOP" : "Upload SOP"}
            </h3>
            <p className="mt-0.5 text-[11px] text-[#405275]">
              {isEdit ? "Update the details for this SOP." : "Create a new SOP record."}
            </p>
          </div>
        </div>
        <SopForm
          sop={isEdit ? selected ?? undefined : undefined}
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
            label="Back to SOPs"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={goToList}
          />
          <h3 className="text-base font-semibold text-[#061632]">SOP Details</h3>
        </div>
        <SopDetail
          sop={selected}
          onBack={goToList}
          onDownload={handleDownload}
          onEdit={(sop) => {
            setSelected(sop);
            setView("edit");
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-0 overflow-y-auto">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-[#061632]">SOPs ({sops.length})</h3>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            size="lg"
            className="h-10 px-3 text-[12px]"
            onClick={() => setView("add")}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add SOP
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

      {feedback ? (
        <div
          className={`mb-4 rounded-lg border px-3 py-2 text-[12px] font-medium ${
            feedback.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      {pendingDelete ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-[13px] leading-5 text-[#061632]">
            Are you sure you want to delete this SOP?
            <span className="mt-1 block font-semibold">{pendingDelete.title}</span>
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
            <Button type="button" variant="destructive" size="sm" onClick={confirmDelete}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Delete
            </Button>
          </div>
        </div>
      ) : null}

      <div className="space-y-5 pb-1">

        {sops.length > 0 ? (
          <div className="space-y-4">
            {sops.map((sop) => (
              <SopCard
                key={sop.id}
                sop={sop}
                onView={(sop) => {
                  setSelected(sop);
                  setView("view");
                }}
                onEdit={(sop) => {
                  setSelected(sop);
                  setView("edit");
                }}
                onDelete={(sop) => {
                  setOpenMenu(null);
                  setPendingDelete(sop);
                }}
                onDownload={handleDownload}
                menuRef={(el) => {
                  menuRefs.current[sop.id] = el;
                }}
                menuOpen={openMenu === sop.id}
                onToggleMenu={() =>
                  setOpenMenu((current) => (current === sop.id ? null : sop.id))
                }
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[#c8d7e8] bg-[#f8fbff] p-5 text-center">
            <FileText className="mx-auto h-7 w-7 text-[#2563eb]" />
            <p className="mt-2 text-[13px] font-semibold text-[#061632]">No SOPs added</p>
            <p className="mt-1 text-[11px] text-[#52657d]">Upload the first SOP for this department.</p>
          </div>
        )}

        <button
          type="button"
          className="text-[12px] font-semibold text-[#004cff] transition-colors hover:text-[#0038ba]"
          onClick={() => setViewAllOpen(true)}
        >
          View All SOPs
        </button>

        <RecentActivity />
      </div>

      {viewAllOpen ? (
        <ViewAllDialog
          sops={sops}
          onClose={() => setViewAllOpen(false)}
          onView={(sop) => {
            setViewAllOpen(false);
            setSelected(sop);
            setView("view");
          }}
          onEdit={(sop) => {
            setViewAllOpen(false);
            setSelected(sop);
            setView("edit");
          }}
          onDelete={(sop) => {
            setViewAllOpen(false);
            setPendingDelete(sop);
          }}
        />
      ) : null}

      <AiGenerationDrawer
        open={aiDrawerOpen}
        kind="SOP"
        onClose={() => setAiDrawerOpen(false)}
        onSave={handleAiSave}
        departmentName={departmentName}
      />
    </div>
  );
}
