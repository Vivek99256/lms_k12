"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  CheckCircle2,
  Languages,
  List,
  RefreshCw,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";

import { API_BASE_URL } from "@/app/components/utils/api_url";
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

export type AiDocumentKind = "SOP" | "Policy" | "Rule";

export type AiGeneratedDocumentSave = {
  title: string;
  category: string;
  description: string;
  status: "Draft" | "Active";
};

export type AiGeneratedDocumentSavedResult = {
  id?: string | number;
  pdfUrl?: string;
};

type AiGenerationDrawerProps = {
  open: boolean;
  kind: AiDocumentKind;
  onClose: () => void;
  onSave: (
    document: AiGeneratedDocumentSave
  ) => void | AiGeneratedDocumentSavedResult | Promise<void | AiGeneratedDocumentSavedResult>;
  departmentName?: string;
  departmentId?: string | number;
};

const includeSections = [
  "Purpose",
  "Scope",
  "Responsibilities",
  "Procedure",
  "Compliance",
  "Records",
  "Approval",
  "Required Documents",
];

const categoryOptions: Record<AiDocumentKind, string[]> = {
  SOP: ["SOP", "Finance", "HR", "Academic", "Administration"],
  Policy: ["Policy", "HR", "Compliance", "Security", "Academic"],
  Rule: ["Rule", "Attendance", "Approval", "Finance", "Security"],
};

const typeOptions: Record<AiDocumentKind, string[]> = {
  SOP: ["New SOP", "Improve Existing SOP", "Convert from Policy"],
  Policy: ["New Policy", "Improve Existing Policy", "Convert from SOP"],
  Rule: ["New Rule", "Improve Existing Rule", "Convert from Policy"],
};

const defaultTitles: Record<AiDocumentKind, string> = {
  SOP: "Fee Collection SOP",
  Policy: "Department Access Policy",
  Rule: "Approval Escalation Rule",
};

const defaultPurpose: Record<AiDocumentKind, string> = {
  SOP: "To standardize the process of collecting student fees accurately and securely.",
  Policy: "To define clear expectations, ownership, and compliance requirements for department operations.",
  Rule: "To automate consistent decisions while keeping approvals transparent and auditable.",
};

type AiGenerationMode = "generate" | "improve" | "regenerate";

type AiGenerationSession = {
  baseUrl: string;
  token: string;
};

type AiSopGenerationResponse = {
  status_code?: number | string;
  message?: string;
  data?: {
    content?: string;
  };
  errors?: Record<string, string[]>;
};

type DepartmentJobRole = {
  id?: string | number | null;
  name?: string;
  label?: string;
  value?: string;
};

type DepartmentJobRolesResponse = {
  status_code?: number | string;
  message?: string;
  data?: DepartmentJobRole[] | { roles?: DepartmentJobRole[] };
  roles?: DepartmentJobRole[];
  errors?: Record<string, string[]>;
};

function readString(value: unknown): string {
  return typeof value === "string"
    ? value
    : value == null
      ? ""
      : String(value);
}

function getAiGenerationSession(): AiGenerationSession {
  if (typeof window === "undefined") {
    return { baseUrl: API_BASE_URL, token: "" };
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
    };
  } catch {
    return { baseUrl: API_BASE_URL, token: "" };
  }
}

function getFirstValidationError(errors?: Record<string, string[]>): string {
  if (!errors) return "";

  const firstKey = Object.keys(errors)[0];
  return firstKey ? errors[firstKey]?.[0] ?? "" : "";
}

function buildGeneratedContent(
  kind: AiDocumentKind,
  title: string,
  purpose: string,
  sections: string[]
) {
  const name = title.trim() || defaultTitles[kind];
  const intro = purpose.trim() || defaultPurpose[kind];
  const lines = sections.map((section, index) => {
    if (section === "Procedure") {
      return `${index + 1}. Procedure\n- Verify the request details and required records.\n- Assign ownership to the responsible role.\n- Complete the action, document evidence, and notify stakeholders.`;
    }

    if (section === "Responsibilities") {
      return `${index + 1}. Responsibilities\n- Department owner: Review and approve the ${kind.toLowerCase()}.\n- Assigned users: Follow the defined steps and maintain records.\n- Compliance team: Monitor exceptions and audit readiness.`;
    }

    if (section === "Approval") {
      return `${index + 1}. Approval\nThis ${kind.toLowerCase()} should be reviewed by the department head and published after final compliance sign-off.`;
    }

    return `${index + 1}. ${section}\n${intro}`;
  });

  return `${name}\n\n${lines.join("\n\n")}`;
}

function stripMarkdown(value: string): string {
  return value
    .replace(/[#*_`]+/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

function resolveRoleRecords(payload: DepartmentJobRolesResponse | null): DepartmentJobRole[] {
  if (!payload) return [];

  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  if (payload.data && typeof payload.data === "object" && Array.isArray(payload.data.roles)) {
    return payload.data.roles;
  }

  if (Array.isArray(payload.roles)) {
    return payload.roles;
  }

  return [];
}

function normalizeRoleRecords(records: DepartmentJobRole[]): DepartmentJobRole[] {
  const seen = new Set<string>();

  return records.reduce<DepartmentJobRole[]>((items, record, index) => {
    const name = readString(record.name ?? record.label ?? record.value).trim();
    if (!name) return items;

    const key = name.toLowerCase();
    if (seen.has(key)) return items;
    seen.add(key);

    items.push({
      id: record.id ?? `${key}-${index}`,
      name,
      label: name,
      value: name,
    });

    return items;
  }, []);
}

function SectionCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 w-full cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#004cff]"
      />

      <span className="text-[12px] leading-5 text-[#405275] break-words">
        {label}
      </span>
    </label>
  );
}
function ToolbarButton({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        title={label}
        className="flex h-7 w-7 items-center justify-center rounded-md text-[#405275] hover:bg-[#eef3ff] hover:text-[#004cff]"
      >
        {children}
      </button>
    </Tooltip>
  );
}

export function Tooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className="tooltip-host relative inline-flex"
      onMouseEnter={(event) => {
        const bubble = event.currentTarget.querySelector(".tooltip-bubble");
        bubble?.classList.remove("opacity-0");
        bubble?.classList.add("opacity-100");
      }}
      onMouseLeave={(event) => {
        const bubble = event.currentTarget.querySelector(".tooltip-bubble");
        bubble?.classList.remove("opacity-100");
        bubble?.classList.add("opacity-0");
      }}
      onFocus={(event) => {
        const bubble = event.currentTarget.querySelector(".tooltip-bubble");
        bubble?.classList.remove("opacity-0");
        bubble?.classList.add("opacity-100");
      }}
      onBlur={(event) => {
        const bubble = event.currentTarget.querySelector(".tooltip-bubble");
        bubble?.classList.remove("opacity-100");
        bubble?.classList.add("opacity-0");
      }}
    >
      {children}
      <span
        role="tooltip"
        className="tooltip-bubble pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#061632] px-2 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity duration-150"
      >
        {label}
      </span>
    </span>
  );
}

export default function AiGenerationDrawer({
  open,
  kind,
  onClose,
  onSave,
  departmentName,
  departmentId,
}: AiGenerationDrawerProps) {
  const [hasGenerated, setHasGenerated] = useState(false);
  const handleClose = useCallback(() => {
    setHasGenerated(false);
    onClose();
  }, [onClose]);
  const selectedDepartmentName = departmentName?.trim() || "";
  const [department, setDepartment] = useState(selectedDepartmentName);

  useEffect(() => {
    if (!selectedDepartmentName) return;

    queueMicrotask(() => setDepartment(selectedDepartmentName));
  }, [selectedDepartmentName]);
  const [category] = useState(categoryOptions[kind][0]);
  const [title, setTitle] = useState(selectedDepartmentName || defaultTitles[kind]);
  const [purpose, setPurpose] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<DepartmentJobRole[]>([]);
  const [customRole, setCustomRole] = useState("");
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState("");
  const [keywords, setKeywords] = useState("");
  const [language, setLanguage] = useState("English");
  const [documentType, setDocumentType] = useState(typeOptions[kind][0]);
  const [detailLevel, setDetailLevel] = useState("Detailed");
  const [selectedSections, setSelectedSections] = useState<string[]>(includeSections);
  const [content, setContent] = useState(() =>
    buildGeneratedContent(kind, defaultTitles[kind], defaultPurpose[kind], includeSections)
  );
  const [generationMode, setGenerationMode] = useState<AiGenerationMode | null>(null);
  const [generationError, setGenerationError] = useState("");
  const [saveMode, setSaveMode] = useState<"Draft" | "Active" | null>(null);
  const [saveError, setSaveError] = useState("");

  const titleLabel = kind === "SOP" ? "SOP Type" : `${kind} Type`;
  const editorTitle = `AI-Generated ${kind} Editor`;
  const isGenerating = generationMode !== null;
  const isSaving = saveMode !== null;
  const roles = useMemo(
    () => selectedRoles.map((role) => readString(role.name ?? role.label ?? role.value).trim()).filter(Boolean).join(", "),
    [selectedRoles]
  );

  useEffect(() => {
    if (hasGenerated) {
      const element = document.getElementById("ai-generated-editor");
      element?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [hasGenerated]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleClose, open]);

  useEffect(() => {
    if (!open || kind !== "SOP") return;

    const selectedDepartmentId = readString(departmentId).trim();

    if (!selectedDepartmentId) {
      queueMicrotask(() => {
        setSelectedRoles([]);
        setRolesError("");
      });
      return;
    }

    const controller = new AbortController();

    async function loadDepartmentRoles() {
      const session = getAiGenerationSession();
      const baseUrl = session.baseUrl.replace(/\/$/, "");
      const url = new URL(`${baseUrl}/api/ai-sop/department-job-roles`);
      url.searchParams.set("department_id", selectedDepartmentId);

      try {
        const userData = JSON.parse(localStorage.getItem("userData") || "{}") as Record<string, unknown>;
        const menuContext = JSON.parse(localStorage.getItem("menuContext") || "{}") as Record<string, unknown>;
        const subInstituteId = readString(userData.sub_institute_id ?? menuContext.sub_institute_id);
        if (subInstituteId) {
          url.searchParams.set("sub_institute_id", subInstituteId);
        }
      } catch {
        // Optional context only.
      }

      setRolesLoading(true);
      setRolesError("");

      try {
        const response = await fetch(url.toString(), {
          method: "GET",
          signal: controller.signal,
          cache: "no-store",
          headers: {
            Accept: "application/json",
            ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
          },
        });

        const payload = (await response.json().catch(() => null)) as DepartmentJobRolesResponse | null;

        if (!response.ok || !payload || String(payload.status_code ?? "0") !== "1") {
          throw new Error(
            getFirstValidationError(payload?.errors) ||
              payload?.message ||
              "Unable to load mapped job roles."
          );
        }

        setSelectedRoles(normalizeRoleRecords(resolveRoleRecords(payload)));
      } catch (error) {
        if (controller.signal.aborted) return;

        setSelectedRoles([]);
        setRolesError(error instanceof Error ? error.message : "Unable to load mapped job roles.");
      } finally {
        if (!controller.signal.aborted) {
          setRolesLoading(false);
        }
      }
    }

    void loadDepartmentRoles();

    return () => controller.abort();
  }, [departmentId, kind, open]);

  const keywordChips = useMemo(
    () =>
      keywords
        .split(",")
        .map((keyword) => keyword.trim())
        .filter(Boolean)
        .slice(0, 4),
    [keywords]
  );

  const addCustomRole = () => {
    const name = customRole.trim();
    if (!name) return;

    setSelectedRoles((current) => {
      const exists = current.some(
        (role) =>
          readString(role.name ?? role.label ?? role.value).trim().toLowerCase() ===
          name.toLowerCase()
      );

      if (exists) return current;

      return [
        ...current,
        {
          id: `custom-${Date.now()}-${name.toLowerCase()}`,
          name,
          label: name,
          value: name,
        },
      ];
    });
    setCustomRole("");
  };

  const requestAiContent = async (mode: AiGenerationMode) => {
    if (kind !== "SOP") {
      if (mode === "improve") {
        setContent((current) =>
          `${current.trim()}\n\nAI Improvement Notes\n- Use measurable ownership for each step.\n- Add exception handling and audit record expectations.\n- Keep language clear for all applicable users.`
        );
      } else {
        setContent(buildGeneratedContent(kind, title, purpose, selectedSections));
      }
      setHasGenerated(true);
      return;
    }

    const trimmedDepartment = department.trim();
    const trimmedTitle = title.trim();
    const trimmedPurpose = purpose.trim();

    if (!trimmedDepartment || !trimmedTitle || !trimmedPurpose) {
      setGenerationError("Department, Title, and Purpose / Short Description are required.");
      return;
    }

    if (selectedSections.length === 0) {
      setGenerationError("Select at least one section to include in the SOP.");
      return;
    }

    const session = getAiGenerationSession();
    const baseUrl = session.baseUrl.replace(/\/$/, "");
    const headers: HeadersInit = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    if (session.token) {
      headers.Authorization = `Bearer ${session.token}`;
    }

    setGenerationMode(mode);
    setGenerationError("");

    try {
      const response = await fetch(`${baseUrl}/api/ai-sop/generate`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          department: trimmedDepartment,
          title: trimmedTitle,
          purpose: trimmedPurpose,
          roles,
          keywords,
          language,
          sop_type: documentType,
          detail_level: detailLevel,
          include_sections: selectedSections,
          existing_content: mode === "generate" ? "" : content,
          mode,
        }),
      });

      const payload = (await response.json().catch(() => null)) as AiSopGenerationResponse | null;

      if (!response.ok || !payload || String(payload.status_code ?? "0") !== "1") {
        throw new Error(
          getFirstValidationError(payload?.errors) ||
            payload?.message ||
            "Unable to generate SOP. Please try again."
        );
      }

      const generatedContent = payload.data?.content?.trim();
      if (!generatedContent) {
        throw new Error("Gemini returned an empty SOP. Please try again.");
      }

      setContent(stripMarkdown(generatedContent));
      setHasGenerated(true);
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Unable to generate SOP. Please try again.");
    } finally {
      setGenerationMode(null);
    }
  };

  const regenerate = () => {
    void requestAiContent("regenerate");
  };

  const improve = () => {
    void requestAiContent("improve");
  };

  const save = async (status: "Draft" | "Active") => {
    setSaveMode(status);
    setSaveError("");

    try {
      await onSave({
        title: title.trim() || defaultTitles[kind],
        category,
        description: content.trim() || buildGeneratedContent(kind, title, purpose, selectedSections),
        status,
      });
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save SOP. Please try again.");
    } finally {
      setSaveMode(null);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 transition ${open ? "pointer-events-auto" : "pointer-events-none"
        }`}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close AI generation drawer"
        className={`absolute inset-0 bg-[#061632]/35 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"
          }`}
        onClick={handleClose}
      />
      <aside
        className={`absolute right-0 top-0 flex h-full w-full max-w-[960px] transform flex-col bg-[#f7faff] shadow-2xl transition-transform duration-300 ease-out sm:w-[92vw] lg:w-[78vw] ${open ? "translate-x-0" : "translate-x-full"
          }`}
        role="dialog"
        aria-modal="true"
        aria-label={`AI ${kind} generation form`}
      >
        <div className="flex items-center justify-between border-b border-[#dce5ef] bg-white px-5 py-4">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-base font-semibold text-[#061632]">
              <Sparkles className="h-4 w-4 text-[#6d28d9]" />
              AI {kind} Generation
            </h3>
            <p className="mt-1 text-[12px] text-[#52657d]">
              Generate, edit, and save a department {kind.toLowerCase()} without leaving details.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#061632] hover:bg-[#f3f7fc]"
            onClick={handleClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-5">
          <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
            <section className="space-y-4 rounded-xl border border-[#dce5ef] bg-white p-4">
              <h4 className="text-[13px] font-semibold text-[#004cff]">1. Basic Information</h4>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="space-y-1.5 text-[12px] font-semibold text-[#061632]">
                  <span>Department</span>
                  <div className="flex h-9 items-center rounded-lg border border-[#d7e0eb] bg-[#f3f7fb] px-3 text-[12px] font-medium text-[#061632]">
                    {department || "—"}
                  </div>
                </div>
              </div>
              <label className="space-y-1 text-[12px] font-semibold text-[#061632]">
                Title
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="h-9 rounded-lg border-[#d7e0eb] bg-white text-[12px]"
                />
              </label>
              <label className="space-y-1.5 text-[12px] font-semibold text-[#061632]">
                Purpose / Short Description
                <Textarea
                  value={purpose}
                  onChange={(event) => setPurpose(event.target.value)}
                  rows={4}
                  placeholder="Enter the purpose or a short description of this SOP."
                  className="min-h-[92px] rounded-lg border-[#d7e0eb] bg-white text-[12px] leading-5 placeholder:text-[#7c8da8]"
                />
              </label>

              <div className="space-y-1.5 text-[12px] font-semibold text-[#061632]">
                <span>Applicable Roles/Users</span>
                <div className="space-y-2 rounded-lg border border-[#d7e0eb] bg-white px-2 py-2">
                  {rolesLoading ? (
                    <p className="px-1 py-1 text-[11px] font-medium text-[#52657d]">
                      Loading mapped roles...
                    </p>
                  ) : selectedRoles.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedRoles.map((role, roleIndex) => {
                        const name = readString(role.name ?? role.label ?? role.value).trim();

                        return (
                          <span
                            key={`${role.id ?? name}-${name}`}
                            className="inline-flex min-h-6 max-w-full items-center gap-1 rounded-md bg-[#eaf1ff] px-2 py-1 text-[11px] font-medium text-[#004cff]"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <span className="truncate">{name}</span>
                            <button
                              type="button"
                              aria-label={`Remove ${name}`}
                              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm hover:bg-[#d7e6ff]"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedRoles((current) =>
                                  current.filter((_, index) => index !== roleIndex)
                                );
                              }}
                            >
                              <X className="h-3 w-3" aria-hidden="true" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="px-1 py-1 text-[11px] font-medium text-[#7c8da8]">
                      No mapped job roles found for this department.
                    </p>
                  )}
                  <div className="flex gap-2 border-t border-[#edf2f8] pt-2">
                    <Input
                      value={customRole}
                      onChange={(event) => setCustomRole(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addCustomRole();
                        }
                      }}
                      placeholder="Add another role or user"
                      className="h-8 rounded-md border-[#d7e0eb] bg-white text-[12px] placeholder:text-[#7c8da8]"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 px-3 text-[12px]"
                      onClick={addCustomRole}
                      disabled={!customRole.trim()}
                    >
                      Add
                    </Button>
                  </div>
                </div>
                {rolesError ? (
                  <p className="text-[11px] font-medium text-red-600">{rolesError}</p>
                ) : null}
              </div>

              <label className="space-y-1.5 text-[12px] font-semibold text-[#061632]">
                Keywords
                <Input
                  value={keywords}
                  onChange={(event) => setKeywords(event.target.value)}
                  placeholder="e.g. Fee Collection, Receipt, Online Payment"
                  className="h-9 rounded-lg border-[#d7e0eb] bg-white text-[12px] placeholder:text-[#7c8da8]"
                />
              </label>
              <div className="flex flex-wrap gap-1.5">
                {keywordChips.map((keyword) => (
                  <span
                    key={keyword}
                    className="rounded-md bg-[#eaf1ff] px-2 py-1 text-[11px] font-medium text-[#004cff]"
                  >
                    {keyword}
                  </span>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <label className="space-y-1.5 text-[12px] font-semibold text-[#061632]">
                  Language
                  <Select
                    value={language}
                    onValueChange={(value) => {
                      if (value) setLanguage(value);
                    }}
                  >
                    <SelectTrigger className="h-9 rounded-lg border-[#d7e0eb] bg-white text-[12px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="English">English</SelectItem>
                      <SelectItem value="Hindi">Hindi</SelectItem>
                      <SelectItem value="Gujarati">Gujarati</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label className="space-y-1.5 text-[12px] font-semibold text-[#061632]">
                  {titleLabel}
                  <Select
                    value={documentType}
                    onValueChange={(value) => {
                      if (value) setDocumentType(value);
                    }}
                  >
                    <SelectTrigger className="h-9 rounded-lg border-[#d7e0eb] bg-white text-[12px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {typeOptions[kind].map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>

              <Button
                type="button"
                className="h-10 w-full bg-[#004cff] text-[12px] font-semibold hover:bg-[#003dcc]"
                onClick={() => void requestAiContent("generate")}
                disabled={isGenerating}
              >
                {generationMode === "generate" ? (
                  <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                )}
                {generationMode === "generate" ? "Generating..." : "Generate with AI"}
              </Button>
              {generationError ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-medium text-red-700">
                  {generationError}
                </p>
              ) : null}
            </section>

            <div className="space-y-4">
              <section className=" gap-4 rounded-xl border border-[#dce5ef] bg-white p-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                <div>
                  <h4 className="text-[13px] font-semibold text-[#6d28d9]">
                    2. AI Generation Options
                  </h4>
                  <div className="mt-3 grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
                    <div className="space-y-2">
                      <p className="text-[12px] font-semibold text-[#061632]">
                        Detail Level
                      </p>

                      <select
                        value={detailLevel}
                        onChange={(e) => setDetailLevel(e.target.value)}
                        className="h-9 w-full rounded-lg border border-[#d7e0eb] bg-white px-3 text-[12px] text-[#061632] shadow-sm focus:border-[#004cff] focus:outline-none"
                      >
                        <option value="Brief">Brief</option>
                        <option value="Standard">Standard</option>
                        <option value="Detailed">Detailed</option>
                      </select>
                    </div>

                    <div className="space-y-2 min-w-0">
                      <p className="text-[12px] font-semibold text-[#061632]">
                        Include Sections
                      </p>

                      <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                        {includeSections.map((section) => (
                          <SectionCheckbox
                            key={section}
                            label={section}
                            checked={selectedSections.includes(section)}
                            onChange={(checked) =>
                              setSelectedSections((current) =>
                                checked
                                  ? [...current, section]
                                  : current.filter((item) => item !== section)
                              )
                            }
                          />
                        ))}
                      </div>
                    </div>

                  </div>
                </div>
              </section>

              {hasGenerated ? (
                <section id="ai-generated-editor" className="rounded-xl border border-[#dce5ef] bg-white p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <h4 className="text-[13px] font-semibold text-[#009f74]">3. {editorTitle}</h4>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-[12px]"
                      onClick={improve}
                      disabled={isGenerating}
                    >
                      {generationMode === "improve" ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <WandSparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {generationMode === "improve" ? "Improving..." : "AI Improve"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-[12px]"
                      onClick={regenerate}
                      disabled={isGenerating}
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${generationMode === "regenerate" ? "animate-spin" : ""}`}
                        aria-hidden="true"
                      />
                      {generationMode === "regenerate" ? "Regenerating..." : "Regenerate"}
                    </Button>
                  </div>
                </div>

                <div className="overflow-visible rounded-lg border border-[#d7e0eb] bg-white">
                  <div className="flex flex-wrap items-center gap-1 border-b border-[#d7e0eb] bg-[#fbfdff] px-2 py-1.5">
                    <select
                      aria-label="Text style"
                      className="h-7 rounded-md border border-[#d7e0eb] bg-white px-2 text-[11px] text-[#405275]"
                      defaultValue="Normal"
                    >
                      <option>Normal</option>
                      <option>Heading</option>
                      <option>Subheading</option>
                    </select>
                    <ToolbarButton label="Bold">
                      <Bold className="h-3.5 w-3.5" />
                    </ToolbarButton>
                    <ToolbarButton label="Bulleted list">
                      <List className="h-3.5 w-3.5" />
                    </ToolbarButton>
                    <ToolbarButton label="Align left">
                      <AlignLeft className="h-3.5 w-3.5" />
                    </ToolbarButton>
                    <ToolbarButton label="Align center">
                      <AlignCenter className="h-3.5 w-3.5" />
                    </ToolbarButton>
                    <ToolbarButton label="Align right">
                      <AlignRight className="h-3.5 w-3.5" />
                    </ToolbarButton>
                  </div>
                  <Textarea
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    rows={16}
                    className="min-h-[330px] resize-y rounded-none border-0 bg-white p-4 font-mono text-[12px] leading-6 text-[#061632] focus-visible:ring-0"
                  />
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[11px] text-[#7c8da8]">
                    AI content may be inaccurate. Review before publishing.
                  </p>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-[12px]"
                      onClick={() => void save("Draft")}
                      disabled={isGenerating || isSaving}
                    >
                      {saveMode === "Draft" ? "Saving..." : "Save Policy"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-[12px]"
                    >
                      <Languages className="h-3.5 w-3.5" aria-hidden="true" />
                      Translate
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 bg-emerald-600 text-[12px] hover:bg-emerald-700"
                      onClick={() => void save("Active")}
                      disabled={isGenerating || isSaving}
                    >
                      {saveMode === "Active" ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {saveMode === "Active" ? "Publishing..." : "Save & Publish"}
                    </Button>
                  </div>
                </div>
                {saveError ? (
                  <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-medium text-red-700">
                    {saveError}
                  </p>
                ) : null}
              </section>
            ) : null}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
