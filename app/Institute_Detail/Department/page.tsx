"use client";

import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "@/app/components/utils/api_url";
import {
  ArrowDown,
  ArrowUp,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Eye,
  Filter,
  Folder,
  MoreVertical,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  UserRound,
  Users,
  X,
} from "lucide-react";
import PoliciesModule from "./Component/polices";
import RulesModule from "./Component/rules";
import SopsModule from "./Component/sops";

type DepartmentStatus = "Active" | "Inactive" | "Pending";

type Employee = {
  id: number;
  employee_no: string;
  gender: string;
  image: string;
  name: string;
  mobile: string;
  department_id: number;
};

type SubDepartment = {
  id: number;
  name: string;
  total_employees: number;
  employees: Employee[];
  sub_departments: SubDepartment[];
};

type Department = {
  id: number;
  name: string;
  total_employees: number;
  employees: Employee[];
  sub_departments: SubDepartment[];
};

type HierarchyResponse = {
  status_code?: number | string;
  message?: string;
  departments?: Department[];
  data?: Department[] | { departments?: Department[] };
};

type DepartmentView = {
  id: string;
  apiId: number;
  name: string;
  shortName: string;
  code: string;
  parent: string;
  head: string;
  title: string;
  employees: number;
  status: DepartmentStatus;
  description: string;
  createdOn: string;
  updatedOn: string;
  employees_list: Employee[];
  sub_departments: SubDepartment[];
};

type HierarchyNode = {
  id: string;
  name: string;
  count: number;
  kind: "department" | "sub" | "employee";
  children?: HierarchyNode[];
};

type ListRow = {
  id: string;
  apiId: number;
  name: string;
  code: string;
  parent: string;
  head: string;
  title: string;
  employees: number;
  status: DepartmentStatus;
  description: string;
  createdOn: string;
  updatedOn: string;
  employees_list: Employee[];
  sub_departments: SubDepartment[];
};

const tabs = ["Overview", "SOPs", "Policies", "Rules"];

type DepartmentSession = {
  baseUrl: string;
  token: string;
  subInstituteId: string;
};

function readString(value: unknown): string {
  return typeof value === "string"
    ? value
    : value == null
      ? ""
      : String(value);
}

function getDepartmentSession(): DepartmentSession {
  if (typeof window === "undefined") {
    return { baseUrl: API_BASE_URL, token: "", subInstituteId: "" };
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
    };
  } catch {
    return { baseUrl: API_BASE_URL, token: "", subInstituteId: "" };
  }
}

function buildDepartmentsUrl(session: DepartmentSession): string {
  const base = session.baseUrl.replace(/\/$/, "");
  const url = new URL(`${base}/api/departments/hierarchy`);
  url.searchParams.set("type", "API");
  if (session.subInstituteId) {
    url.searchParams.set("sub_institute_id", session.subInstituteId);
  }
  return url.toString();
}

function resolveDepartments(payload: unknown): Department[] {
  if (!payload || typeof payload !== "object") return [];

  const record = payload as Record<string, unknown>;

  if (Array.isArray(record.departments)) {
    return record.departments as Department[];
  }

  const data = record.data;
  if (Array.isArray(data)) {
    return data as Department[];
  }

  if (data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).departments)) {
    return (data as { departments: Department[] }).departments;
  }

  if (Array.isArray(payload)) {
    return payload as Department[];
  }

  return [];
}

function StatusBadge({ status }: { status: DepartmentStatus }) {
  const classes = {
    Active: "border-emerald-200 bg-emerald-50 text-emerald-600",
    Inactive: "border-slate-300 bg-slate-50 text-slate-500",
    Pending: "border-amber-200 bg-amber-50 text-amber-600",
  };

  return (
    <span
      className={`inline-flex h-[18px] items-center rounded-full border px-2 text-[10px] font-medium leading-none ${classes[status]}`}
    >
      {status}
    </span>
  );
}

function SearchField({
  value,
  onChange,
  className = "",
  placeholder = "Search department...",
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}) {
  return (
    <label className={`relative block ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#51627a]" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-8 w-full rounded-md border border-[#d7e0eb] bg-[#f9fbfe] pl-9 pr-9 text-[11px] text-[#1f3654] outline-none placeholder:text-[#5f6f85] focus:border-[#8ab3f5] focus:bg-white"
      />
      <Search className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#071225]" />
    </label>
  );
}

function HierarchyItem({
  node,
  level,
  collapsedIds,
  selectedId,
  onToggle,
  onSelect,
}: {
  node: HierarchyNode;
  level: number;
  collapsedIds: Set<string>;
  selectedId: string;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const selected = node.id === selectedId;
  const hasChildren = Boolean(node.children?.length);
  const collapsed = collapsedIds.has(node.id);
  const isEmployee = node.kind === "employee";

  return (
    <div>
      <div
        className={`group grid h-[31px] w-full grid-cols-[18px_16px_minmax(0,1fr)_auto_18px] items-center gap-1 rounded-md px-2 text-left text-[11px] font-medium ${
          isEmployee
            ? "text-[#64748b]"
            : selected
              ? "bg-[#e8efff] text-[#0b4efb]"
              : "text-[#061632] hover:bg-[#f4f7fb]"
        }`}
        style={{ paddingLeft: `${8 + level * 15}px` }}
      >
        <button
          type="button"
          aria-label={collapsed ? "Expand" : "Collapse"}
          onClick={() => hasChildren && onToggle(node.id)}
          className={`flex h-4 w-4 items-center justify-center ${
            hasChildren ? "text-[#304a6c] hover:text-[#0b4efb]" : "text-transparent"
          }`}
        >
          {hasChildren ? (
            collapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )
          ) : (
            <span className="h-3.5 w-3.5" />
          )}
        </button>
        {isEmployee ? (
          <UserRound className="h-3.5 w-3.5 text-[#94a3b8]" />
        ) : (
          <Folder className="h-3.5 w-3.5 text-[#0d6efd]" />
        )}
        <button
          type="button"
          onClick={() => !isEmployee && onSelect(node.id)}
          className="truncate text-left"
        >
          {node.name}
        </button>
        <span className="rounded-full border border-[#dce5ef] bg-[#f4f8fd] px-2 py-0.5 text-[10px] font-medium text-[#577092]">
          {node.count}
        </span>
        {selected && !isEmployee ? (
          <MoreVertical className="h-3.5 w-3.5 text-[#061632]" />
        ) : (
          <span />
        )}
      </div>
      {hasChildren && !collapsed ? (
        <div className="relative">
          <span
            className="absolute bottom-1 top-0 w-px bg-[#c8d7e8]"
            style={{ left: `${41 + level * 15}px` }}
          />
          {node.children?.map((child) => (
            <HierarchyItem
              key={child.id}
              node={child}
              level={level + 1}
              collapsedIds={collapsedIds}
              selectedId={selectedId}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ToolbarButton({
  children,
  className = "",
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-8 items-center justify-center border border-[#d7e0eb] bg-[#f8fbff] text-[#031633] hover:bg-white ${className}`}
    >
      {children}
    </button>
  );
}

function DepartmentDetailsHeader({
  onClose,
}: {
  onClose: () => void;
}) {
  return (
    <div className="flex h-[50px] items-center justify-between border-b border-[#e4ebf3] px-3.5">
      <h2 className="text-[13px] font-semibold text-[#061632]">
        Department Details
      </h2>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();

          console.log("Close Click");
          onClose();
        }}
        className=" px-3 py-2 text-black"
      >
        CLOSE
      </button>
    </div>
  );
}
function DetailLine({
  icon,
  label,
  value,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  action?: string;
}) {
  return (
    <div className="grid grid-cols-[18px_minmax(0,1fr)_70px] items-start gap-3 py-2">
      <span className="mt-0.5 flex h-4 w-4 items-center justify-center text-[#071225]">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] leading-4 text-[#64748b]">{label}</p>
        <p className="mt-0.5 text-[11px] font-semibold leading-4 text-[#061632]">
          {value}
        </p>
      </div>
      {action ? (
        <button
          type="button"
          className="mt-5 text-right text-[9px] font-medium text-[#004cff]"
        >
          {action}
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getHeadInfo(employees: Employee[]): Pick<DepartmentView, "head" | "title"> {
  const head = employees[0]?.name?.trim();
  return {
    head: head || "-",
    title: head ? "Department Lead" : "",
  };
}

function directEmployeeCount(employees: Employee[] | undefined, fallback: number): number {
  return employees && employees.length > 0 ? employees.length : fallback;
}

function subDepartmentEmployeeTotal(subDepartment: SubDepartment): number {
  return (
    directEmployeeCount(subDepartment.employees, subDepartment.total_employees ?? 0) +
    (subDepartment.sub_departments ?? []).reduce(
      (total, child) => total + subDepartmentEmployeeTotal(child),
      0
    )
  );
}

function mapSubDepartmentNode(
  departmentId: string,
  subDepartment: SubDepartment,
  parentPath = ""
): HierarchyNode {
  const id = parentPath
    ? `${parentPath}-s-${subDepartment.id}`
    : `${departmentId}-s-${subDepartment.id}`;
  const children = (subDepartment.sub_departments ?? []).map((child) =>
    mapSubDepartmentNode(departmentId, child, id)
  );

  return {
    id,
    name: subDepartment.name,
    count: subDepartmentEmployeeTotal(subDepartment),
    kind: "sub",
    children: children.length ? children : undefined,
  };
}

function buildHierarchy(departments: DepartmentView[]): HierarchyNode[] {
  const mapNode = (
    name: string,
    count: number,
    id: string,
    kind: HierarchyNode["kind"],
    children?: HierarchyNode[]
  ): HierarchyNode => ({
    id,
    name,
    count,
    kind,
    children: children && children.length ? children : undefined,
  });

  return departments.map((department) => {
    const children = (department.sub_departments ?? []).map((sub) =>
      mapSubDepartmentNode(department.id, sub)
    );
    const descendantEmployees = (department.sub_departments ?? []).reduce(
      (total, sub) => total + subDepartmentEmployeeTotal(sub),
      0
    );

    return mapNode(
      department.name,
      directEmployeeCount(department.employees_list, department.employees) +
        descendantEmployees,
      department.id,
      "department",
      children
    );
  });
}

function buildListRows(departments: DepartmentView[]): ListRow[] {
  const rows: ListRow[] = [];

  const addSub = (
    deptId: string,
    subs: SubDepartment[],
    parentName: string,
    parentPath = ""
  ) => {
    for (const sub of subs) {
      const id = parentPath ? `${parentPath}-s-${sub.id}` : `${deptId}-s-${sub.id}`;
      const employees = sub.employees ?? [];
      const headInfo = getHeadInfo(employees);
      rows.push({
        id,
        apiId: sub.id,
        name: sub.name,
        code: `SD-${sub.id}`,
        parent: parentName,
        head: headInfo.head,
        title: headInfo.title,
        employees: sub.total_employees ?? 0,
        status: "Active",
        description: `${sub.name} operates under ${parentName}.`,
        createdOn: "-",
        updatedOn: "-",
        employees_list: employees,
        sub_departments: sub.sub_departments ?? [],
      });
      addSub(deptId, sub.sub_departments ?? [], sub.name, id);
    }
  };

  for (const department of departments) {
    rows.push({
      id: department.id,
      apiId: department.apiId,
      name: department.name,
      code: department.code,
      parent: department.parent,
      head: department.head,
      title: department.title,
      employees: department.employees,
      status: department.status,
      description: department.description,
      createdOn: department.createdOn,
      updatedOn: department.updatedOn,
      employees_list: department.employees_list,
      sub_departments: department.sub_departments,
    });
    addSub(department.id, department.sub_departments ?? [], department.name);
  }

  return rows;
}

function findNode(nodes: HierarchyNode[], id: string): HierarchyNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

function collectSubtreeIds(node: HierarchyNode): Set<string> {
  const ids = new Set<string>([node.id]);
  for (const child of node.children ?? []) {
    for (const id of collectSubtreeIds(child)) ids.add(id);
  }
  return ids;
}

function collectAncestorIds(
  nodes: HierarchyNode[],
  id: string,
  trail: string[] = []
): string[] | null {
  for (const node of nodes) {
    const next = [...trail, node.id];
    if (node.id === id) return next;
    if (node.children) {
      const found = collectAncestorIds(node.children, id, next);
      if (found) return found;
    }
  }
  return null;
}

export default function DepartmentPage() {
  const [departments, setDepartments] = useState<DepartmentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("Overview");
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDepartments() {
      try {
        setLoading(true);
        setError(null);

        const session = getDepartmentSession();
        const url = buildDepartmentsUrl(session);

        if (!session.subInstituteId) {
          throw new Error("Current session is missing sub institute id.");
        }

        const response = await fetch(url, {
          signal: controller.signal,
          cache: "no-store",
          headers: {
            ...(session.token
              ? { Authorization: `Bearer ${session.token}` }
              : {}),
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to load departments (status ${response.status})`);
        }

        const data: HierarchyResponse = await response.json();
        const source = resolveDepartments(data);

        const views: DepartmentView[] = source.map((department) => {
          const employees = department.employees ?? [];
          const headInfo = getHeadInfo(employees);
          return {
            id: String(department.id),
            apiId: department.id,
            name: department.name,
            shortName:
              department.name.length > 16
                ? `${department.name.slice(0, 14)}...`
                : department.name,
            code: `D-${department.id}`,
            parent: "-",
            head: headInfo.head,
            title: headInfo.title,
            employees: department.total_employees ?? employees.length,
            status: "Active",
            description: `${department.name} manages its operations, staff, and day-to-day activities.`,
            createdOn: "—",
            updatedOn: "—",
            employees_list: employees,
            sub_departments: department.sub_departments ?? [],
          };
        });

        setDepartments(views);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadDepartments();

    return () => controller.abort();
  }, []);

  const hierarchy = useMemo(() => buildHierarchy(departments), [departments]);
  const listRows = useMemo(() => buildListRows(departments), [departments]);

  const filteredDepartments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const baseRows =
      selectedNodeId != null
        ? (() => {
            const node = findNode(hierarchy, selectedNodeId);
            if (!node) return listRows;
            const subtreeIds = collectSubtreeIds(node);
            return listRows.filter((row) => subtreeIds.has(row.id));
          })()
        : listRows.filter((row) => row.parent === "-");

    return baseRows.filter((row) => {
      const matchesSearch =
        !normalizedQuery || row.name.toLowerCase().includes(normalizedQuery);
      const matchesStatus = status === "All" || row.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [hierarchy, listRows, query, selectedNodeId, status]);

  const visibleDepartments = filteredDepartments.slice(0, 10);
  const selectedDepartment =
    listRows.find((department) => department.id === selectedId) ??
    null;

  function handleSelectNode(id: string) {
    setSelectedNodeId(id);
    setSelectedId(id);
    setShowDetails(true);
    setCollapsedIds((prev) => {
      const trail = collectAncestorIds(hierarchy, id);
      if (!trail) return prev;
      const next = new Set(prev);
      for (const ancestorId of trail.slice(0, -1)) next.delete(ancestorId);
      return next;
    });
  }

  function handleToggle(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleCloseDetails() {
    console.log("Close button clicked");
    setShowDetails(false);
    setSelectedId(null);
    setSelectedNodeId(null);
  }

  if (loading) {
    return (
      <main className="flex h-[calc(100vh-12px)] min-h-[570px] items-center justify-center bg-[#f3f7fc] text-[#061632]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-6 w-6 animate-spin text-[#2f6df6]" />
          <p className="text-[12px] font-medium text-[#405275]">
            Loading departments…
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex h-[calc(100vh-12px)] min-h-[570px] items-center justify-center bg-[#f3f7fc] text-[#061632]">
        <div className="flex max-w-sm flex-col items-center gap-3 rounded-lg border border-[#f3c9c9] bg-white px-6 py-8 text-center shadow-sm">
          <X className="h-6 w-6 text-[#dc2626]" />
          <p className="text-[12px] font-semibold text-[#061632]">
            Could not load departments
          </p>
          <p className="text-[11px] leading-4 text-[#405275]">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-1 inline-flex h-8 items-center gap-1.5 rounded-md bg-[#2f6df6] px-3 text-[11px] font-medium text-white hover:bg-[#2f6df6]/90"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="h-[calc(100vh-12px)] min-h-[570px] overflow-hidden bg-[#f3f7fc] p-1.5 text-[#061632]">
      <div
        className={`grid h-full min-w-[1180px] gap-2 ${
          showDetails
            ? "grid-cols-[258px_minmax(620px,1fr)_288px]"
            : "grid-cols-[258px_minmax(620px,1fr)]"
        }`}
      >
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[#d4dee9] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
          <div className="px-3.5 pb-3 pt-4">
            <h2 className="mb-3.5 text-[13px] font-semibold text-[#061632]">
              Department Hierarchy
            </h2>
            <SearchField value={query} onChange={setQuery} />
          </div>
          <div className="border-t border-[#e4ebf3]" />
          <div className="min-h-0 flex-1 overflow-hidden px-3 py-3">
            {hierarchy.length === 0 ? (
              <p className="px-2 py-4 text-[11px] text-[#64748b]">
                No departments available.
              </p>
            ) : (
              hierarchy.map((node) => (
                <HierarchyItem
                  key={node.id}
                  node={node}
                  level={0}
                  collapsedIds={collapsedIds}
                  selectedId={selectedNodeId ?? ""}
                  onToggle={handleToggle}
                  onSelect={handleSelectNode}
                />
              ))
            )}
          </div>
          <div className="grid grid-cols-4 border-t border-[#e4ebf3] p-3">
            <ToolbarButton className="rounded-l-md">
              <Plus className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton>
              <ArrowUp className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton>
              <ArrowDown className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton className="rounded-r-md">
              <ChevronsUpDown className="h-3.5 w-3.5" />
            </ToolbarButton>
          </div>
        </aside>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[#d4dee9] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
          <div className="px-3.5 pb-3 pt-4">
            <h1 className="mb-3.5 text-[13px] font-semibold text-[#061632]">
              Department List ({filteredDepartments.length})
            </h1>
            <SearchField value={query} onChange={setQuery} />
            <div className="mt-2 grid grid-cols-[1fr_auto_auto_auto] gap-2">
              <label className="relative">
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="h-8 w-full appearance-none rounded-md border border-[#d7e0eb] bg-white px-2.5 pr-8 text-[11px] text-[#061632] outline-none focus:border-[#8ab3f5]"
                >
                  <option value="All">Status: All</option>
                  <option value="Active">Status: Active</option>
                  <option value="Inactive">Status: Inactive</option>
                  <option value="Pending">Status: Pending</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748b]" />
              </label>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#d7e0eb] bg-white px-2.5 text-[11px] font-medium text-[#061632] hover:bg-[#f8fbff]"
              >
                <Filter className="h-3.5 w-3.5" />
                Filters
              </button>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setStatus("All");
                  setSelectedNodeId(null);
                  setSelectedId(null);
                  setShowDetails(false);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-[#d7e0eb] bg-white text-[#061632] hover:bg-[#f8fbff]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden border-t border-[#dfe7f0]">
            <table className="w-full table-fixed border-collapse text-left">
              <thead>
                <tr className="h-9 border-b border-[#dfe7f0] bg-[#f2f5f8] text-[10px] font-semibold text-[#334155]">
                  <th className="w-[24%] px-3.5">
                    <span className="inline-flex items-center gap-1">
                      Department <ArrowUp className="h-2.5 w-2.5" />
                    </span>
                  </th>
                  <th className="w-[10%] px-2">Code</th>
                  <th className="w-[16%] px-2">Parent</th>
                  <th className="w-[18%] px-2">Head</th>
                  <th className="w-[12%] px-3 text-center">Employees</th>
                  <th className="w-[13%] px-3">Status</th>
                  <th className="w-[7%] px-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleDepartments.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="h-[120px] text-center text-[11px] text-[#64748b]"
                    >
                      No departments match the current filters.
                    </td>
                  </tr>
                ) : (
                   visibleDepartments.map((department) => (
                    <tr
                      key={department.id}
                      onClick={() => handleSelectNode(department.id)}
                      className={`h-[55px] cursor-pointer border-b border-[#dfe7f0] text-[11px] ${
                        selectedNodeId === department.id
                          ? "bg-[#e9f0ff]"
                          : "bg-white hover:bg-[#f8fbff]"
                      }`}
                    >
                      <td className="truncate px-3.5 font-semibold text-[#061632]">
                        {department.name}
                      </td>
                      <td className="px-2 font-semibold text-[#061632]">
                        {department.code}
                      </td>
                      <td className="px-2 text-[#405275]">
                        <span className="block truncate">{department.parent}</span>
                      </td>
                      <td className="px-2">
                        {department.head === "-" ? (
                          <span className="font-semibold text-[#061632]">-</span>
                        ) : (
                        <div className="flex items-center gap-2">
                          {/* <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f0f3f7] text-[10px] font-medium text-[#64748b]">
                            {department.head === "Unassigned"
                              ? "—"
                              : initials(department.head)}
                          </span> */}
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-[#061632]">
                              {department.head}
                            </span>
                            <span className="block truncate text-[10px] text-[#405275]">
                              {department.title}
                            </span>
                          </span>
                        </div>
                        )}
                      </td>
                      <td className="px-3 text-center font-semibold text-[#061632]">
                        {department.employees}
                      </td>
                      <td className="px-3">
                        <StatusBadge status={department.status} />
                      </td>
                      <td className="px-2 text-center">
                        <button
                          type="button"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#061632] hover:bg-white"
                          aria-label={`View ${department.name}`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex h-[51px] items-center justify-between border-t border-[#dfe7f0] px-3.5">
            <p className="text-[11px] text-[#405275]">
              Showing 1 to {visibleDepartments.length} of {filteredDepartments.length} entries
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-[#d7e0eb] bg-[#f8fbff] text-[#94a3b8]"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-md bg-[#2f6df6] text-[12px] font-semibold text-white"
              >
                1
              </button>
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-[#d7e0eb] bg-white text-[12px] text-[#061632]"
              >
                2
              </button>
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-[#d7e0eb] bg-[#f8fbff] text-[#061632]"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </section>

        {showDetails && selectedDepartment ? (
          <aside
            className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[#d4dee9] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
          >
            <DepartmentDetailsHeader onClose={handleCloseDetails} />
            <div className="flex items-center gap-3 px-3.5 py-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#2f6df6] text-white">
                <Building2 className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate text-[13px] font-semibold text-[#061632]">
                    {selectedDepartment.name}
                  </h3>
                  <StatusBadge status={selectedDepartment.status} />
                </div>
                <p className="mt-2 truncate text-[11px] text-[#405275]">
                  {selectedDepartment.code} <span className="px-1">-</span>{" "}
                  {selectedDepartment.parent}
                </p>
              </div>
            </div>
            <div className="grid h-9 grid-cols-4 border-y border-[#e4ebf3]">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`border-b-2 text-[11px] font-medium ${
                    activeTab === tab
                      ? "border-[#1d57ff] text-[#004cff]"
                      : "border-transparent text-[#334155]"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-3.5 py-5">
              {activeTab === "SOPs" ? (
                <SopsModule departmentName={selectedDepartment?.name} departmentId={selectedDepartment?.apiId} />
              ) : activeTab === "Policies" ? (
                <PoliciesModule departmentName={selectedDepartment?.name} />
              ) : activeTab === "Rules" ? (
                <RulesModule departmentName={selectedDepartment?.name} />
              ) : activeTab === "Overview" ? (
                <>
                  <div className="border-t border-[#dfe7f0] pt-3">
                    <DetailLine
                      icon={<UserRound className="h-3.5 w-3.5" />}
                      label="Department Head"
                      value={selectedDepartment.head}
                      action="Change HOD"
                    />
                    <DetailLine
                      icon={<Folder className="h-3.5 w-3.5" />}
                      label="Parent Department"
                      value={selectedDepartment.parent}
          
                    />
                    <DetailLine
                      icon={<Users className="h-3.5 w-3.5" />}
                      label="Total Employees"
                      value={String(selectedDepartment.employees)}
                    />
                    <DetailLine
                      icon={<CalendarDays className="h-3.5 w-3.5" />}
                      label="Created On"
                      value={selectedDepartment.createdOn}
                    />
                    <DetailLine
                      icon={<RotateCcw className="h-3.5 w-3.5" />}
                      label="Last Updated"
                      value={selectedDepartment.updatedOn}
                    />
                  </div>
                  <div className="mt-4 border-t border-[#dfe7f0] pt-4">
                    <h4 className="mb-2 text-[12px] font-semibold text-[#061632]">
                      Description
                    </h4>
                    <p className="text-[11px] leading-[19px] text-[#405275]">
                      {selectedDepartment.description}
                    </p>
                  </div>
                  <div className="mt-4 border-t border-[#dfe7f0] pt-4">
                    <h4 className="mb-2 text-[12px] font-semibold text-[#061632]">
                      Employees ({selectedDepartment.employees_list.length})
                    </h4>
                    {selectedDepartment.employees_list.length === 0 ? (
                      <p className="text-[11px] leading-5 text-[#405275]">
                        No employees assigned to this department.
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {selectedDepartment.employees_list.map((employee) => (
                          <li
                            key={employee.id}
                            className="flex items-center gap-2 rounded-md border border-[#e4ebf3] px-2.5 py-2"
                          >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f0f3f7] text-[10px] font-medium text-[#64748b]">
                              {initials(employee.name)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[11px] font-semibold text-[#061632]">
                                {employee.name}
                              </span>
                              <span className="block truncate text-[10px] text-[#405275]">
                                Emp No: {employee.employee_no}
                                {employee.gender ? ` • ${employee.gender}` : ""}
                              </span>
                            </span>
                            {employee.mobile && employee.mobile !== "-" ? (
                              <span className="shrink-0 text-[10px] text-[#405275]">
                                {employee.mobile}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                    {selectedDepartment.sub_departments.length > 0 ? (
                      <div className="mt-4 border-t border-[#dfe7f0] pt-4">
                        <h4 className="mb-2 text-[12px] font-semibold text-[#061632]">
                          Sub Departments (
                          {selectedDepartment.sub_departments.length})
                        </h4>
                        <ul className="flex flex-col gap-2">
                          {selectedDepartment.sub_departments.map((sub) => (
                            <li
                              key={sub.id}
                              className="flex items-center gap-2 rounded-md border border-[#e4ebf3] px-2.5 py-2"
                            >
                              <Folder className="h-3.5 w-3.5 shrink-0 text-[#0d6efd]" />
                              <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-[#061632]">
                                {sub.name}
                              </span>
                              <span className="shrink-0 rounded-full border border-[#dce5ef] bg-[#f4f8fd] px-2 py-0.5 text-[10px] font-medium text-[#577092]">
                                {sub.total_employees} emp
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="border-t border-[#dfe7f0] pt-4">
                  <p className="text-[11px] leading-5 text-[#405275]">
                    No {activeTab.toLowerCase()} records configured for this
                    department.
                  </p>
                </div>
              )}
            </div>
          </aside>
        ) : null}
      </div>
    </main>
  );
}
