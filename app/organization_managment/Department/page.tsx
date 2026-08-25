"use client";

import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "@/app/components/utils/api_url";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Download,
  Eye,
  Filter,
  Folder,
  FolderOpen,
  Info,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  UserPlus,
  UserRound,
  Users,
  X,
} from "lucide-react";
import PoliciesModule from "./Component/polices";
import RulesModule from "./Component/rules";
import SopsModule from "./Component/sops";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { buildSessionContext } from "@/lib/erp-client";
import {
  createDepartment,
  deleteDepartment,
  updateDepartment,
} from "../_lib/department-management-api";

type DepartmentStatus = "Active" | "Inactive" | "Pending";
type SortKey = "name" | "code" | "parent" | "head" | "employees" | "status";

const PAGE_SIZE = 10;
const BREADCRUMB = [
  "Home",
  "Organizational Management",
  "Organization Setup",
  "Department Management",
];

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

function Breadcrumb() {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
      {BREADCRUMB.map((item, index) => (
        <span key={item} className="flex items-center gap-1.5">
          {index > 0 ? <ChevronRight className="h-3 w-3" aria-hidden="true" /> : null}
          <span className={index === BREADCRUMB.length - 1 ? "font-medium text-foreground" : undefined}>
            {item}
          </span>
        </span>
      ))}
    </nav>
  );
}

function SearchField({
  value,
  onChange,
  className,
  placeholder = "Search department...",
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}) {
  return (
    <div className={cn("relative w-full", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-9 rounded-md bg-background pl-9"
      />
    </div>
  );
}

function PanelHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-4">
      <h2 className="text-[13px] font-semibold text-foreground">{title}</h2>
      {action}
    </div>
  );
}

function hierarchyMatches(node: HierarchyNode, query: string): boolean {
  if (!query) return true;
  return (
    node.name.toLowerCase().includes(query) ||
    (node.children ?? []).some((child) => hierarchyMatches(child, query))
  );
}

function HierarchyItem({
  node,
  level,
  collapsedIds,
  selectedId,
  query,
  onToggle,
  onSelect,
}: {
  node: HierarchyNode;
  level: number;
  collapsedIds: Set<string>;
  selectedId: string;
  query: string;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const selected = node.id === selectedId;
  const hasChildren = Boolean(node.children?.length);
  const collapsed = collapsedIds.has(node.id);
  const isEmployee = node.kind === "employee";
  const normalizedQuery = query.trim().toLowerCase();
  const childMatches = (node.children ?? []).some((child) =>
    hierarchyMatches(child, normalizedQuery)
  );
  const visible =
    !normalizedQuery || node.name.toLowerCase().includes(normalizedQuery) || childMatches;

  if (!visible) return null;

  const open = hasChildren && !collapsed;

  return (
    <div>
      <div
        className={cn(
          "group flex h-9 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium",
          isEmployee
            ? "text-muted-foreground"
            : selected
              ? "bg-blue-50 text-blue-600"
              : "text-foreground hover:bg-muted"
        )}
        style={{ paddingLeft: `${8 + level * 15}px` }}
      >
        <button
          type="button"
          aria-label={collapsed ? "Expand" : "Collapse"}
          onClick={() => hasChildren && onToggle(node.id)}
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center",
            hasChildren ? "text-muted-foreground hover:text-blue-600" : "invisible"
          )}
        >
          <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
        </button>
        {isEmployee ? (
          <UserRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : open ? (
          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-blue-600" />
        ) : (
          <Folder className="h-3.5 w-3.5 shrink-0 text-blue-600" />
        )}
        <button
          type="button"
          onClick={() => !isEmployee && onSelect(node.id)}
          className="min-w-0 flex-1 truncate text-left"
        >
          {node.name}
        </button>
        <Badge variant="secondary" className="rounded-md px-2">
          {node.count}
        </Badge>
        {selected && !isEmployee ? (
          <MoreVertical className="h-3.5 w-3.5 shrink-0 text-foreground" />
        ) : (
          <span className="w-3.5" />
        )}
      </div>
      {hasChildren && (open || childMatches) ? (
        <div className="ml-4 space-y-0.5 border-l border-dotted border-blue-200 py-0.5">
          {node.children?.map((child) => (
            <HierarchyItem
              key={child.id}
              node={child}
              level={level + 1}
              collapsedIds={collapsedIds}
              selectedId={selectedId}
              query={query}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FooterIcon({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-9 items-center justify-center border border-border bg-background text-foreground transition-colors first:rounded-l-md last:rounded-r-md hover:bg-muted"
    >
      {icon}
    </button>
  );
}

function SortHead({
  label,
  sortKey,
  activeKey,
  asc,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  asc: boolean;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 normal-case text-foreground"
      >
        {label}
        {activeKey === sortKey ? (
          <ChevronDown className={cn("h-3 w-3 transition-transform", asc && "rotate-180")} />
        ) : null}
      </button>
    </TableHead>
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

function Person({ name, title }: { name: string; title: string }) {
  const unassigned = name === "-";
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
        {unassigned ? "UA" : initials(name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[12px] font-medium text-foreground">
          {unassigned ? "Unassigned" : name}
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {unassigned ? "No HOD" : title || "Department Head"}
        </span>
      </span>
    </div>
  );
}

function IconAction({
  label,
  icon,
  className,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted",
        className
      )}
    >
      {icon}
    </button>
  );
}

function RowMenu({
  isSubDepartment,
  onEdit,
  onAddSubDepartment,
  onDelete,
}: {
  isSubDepartment: boolean;
  onEdit: () => void;
  onAddSubDepartment: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Department actions"
        onClick={(event) => event.stopPropagation()}
        className="flex h-8 w-8 items-center justify-center rounded-md text-foreground outline-none transition-colors hover:bg-muted"
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[220px] rounded-lg">
        <DropdownMenuItem>
          <Eye className="h-3.5 w-3.5" />
          View details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
          Edit {isSubDepartment ? "sub-department" : "department"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onAddSubDepartment}>
          <Plus className="h-3.5 w-3.5" />
          Add sub-department
        </DropdownMenuItem>
        <DropdownMenuItem>
          <UserPlus className="h-3.5 w-3.5" />
          Assign / change HOD
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
          Remove {isSubDepartment ? "sub-department" : "department"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PaginationButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
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
      <span className="mt-0.5 flex h-4 w-4 items-center justify-center text-foreground">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] leading-4 text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-[11px] font-semibold leading-4 text-foreground">
          {value}
        </p>
      </div>
      {action ? (
        <button
          type="button"
          className="mt-5 text-right text-[9px] font-medium text-blue-600"
        >
          {action}
        </button>
      ) : (
        <span />
      )}
    </div>
  );
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

  const [treeQuery, setTreeQuery] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [parentFilter, setParentFilter] = useState("All");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hierarchyFilter, setHierarchyFilter] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("Overview");

  // Add/Edit/Delete dialog + inline notice state for the department CRUD
  // actions (hierarchy() GET above stays untouched).
  const [actionNotice, setActionNotice] = useState<
    { type: "success" | "error"; message: string } | null
  >(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addParent, setAddParent] = useState<ListRow | null>(null);
  const [addName, setAddName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ListRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ListRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  async function fetchDepartments(signal?: AbortSignal, showLoader = true) {
    try {
      if (showLoader) setLoading(true);
      setError(null);

      const session = getDepartmentSession();
      const url = buildDepartmentsUrl(session);

      if (!session.subInstituteId) {
        throw new Error("Current session is missing sub institute id.");
      }

      const response = await fetch(url, {
        signal,
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
      if (signal?.aborted) return;
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
    } finally {
      if (!signal?.aborted && showLoader) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    fetchDepartments(controller.signal, true);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hierarchy = useMemo(() => buildHierarchy(departments), [departments]);
  const listRows = useMemo(() => buildListRows(departments), [departments]);
  const parentOptions = useMemo(
    () =>
      Array.from(new Set(listRows.map((row) => row.parent).filter((parent) => parent !== "-"))),
    [listRows]
  );

  const filteredDepartments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const subtreeIds = hierarchyFilter
      ? (() => {
          const node = findNode(hierarchy, hierarchyFilter);
          return node ? collectSubtreeIds(node) : null;
        })()
      : null;

    const rows = listRows.filter((row) => {
      const matchesSearch =
        !normalizedQuery ||
        row.name.toLowerCase().includes(normalizedQuery) ||
        row.code.toLowerCase().includes(normalizedQuery) ||
        row.parent.toLowerCase().includes(normalizedQuery) ||
        row.head.toLowerCase().includes(normalizedQuery);
      const matchesStatus = status === "All" || row.status === status;
      const matchesParent =
        parentFilter === "All" ||
        (parentFilter === "Root" ? row.parent === "-" : row.parent === parentFilter);
      const matchesHierarchy = !subtreeIds || subtreeIds.has(row.id);

      return matchesSearch && matchesStatus && matchesParent && matchesHierarchy;
    });

    rows.sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";

      switch (sortKey) {
        case "code":
          av = a.code;
          bv = b.code;
          break;
        case "parent":
          av = a.parent;
          bv = b.parent;
          break;
        case "head":
          av = a.head;
          bv = b.head;
          break;
        case "employees":
          av = a.employees;
          bv = b.employees;
          break;
        case "status":
          av = a.status;
          bv = b.status;
          break;
        default:
          av = a.name;
          bv = b.name;
      }

      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });

    return rows;
  }, [hierarchy, listRows, query, status, parentFilter, hierarchyFilter, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filteredDepartments.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filteredDepartments.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const selectedRow = selectedId
    ? (listRows.find((row) => row.id === selectedId) ?? null)
    : null;
  const showDetails = Boolean(selectedRow);

  function selectRow(id: string) {
    setSelectedId(id);
  }

  function selectFromHierarchy(id: string) {
    setSelectedId(id);
    setHierarchyFilter(id);
    setPage(1);
    setCollapsedIds((prev) => {
      const trail = collectAncestorIds(hierarchy, id);
      if (!trail) return prev;
      const next = new Set(prev);
      for (const ancestorId of trail.slice(0, -1)) next.delete(ancestorId);
      return next;
    });
  }

  function clearHierarchyFilter() {
    setHierarchyFilter(null);
    setPage(1);
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
    setSelectedId(null);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((value) => !value);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  function openAddDialog(parent: ListRow | null = null) {
    setAddParent(parent);
    setAddName("");
    setAddError(null);
    setAddDialogOpen(true);
  }

  async function submitAdd() {
    const name = addName.trim();
    if (!name) {
      setAddError("Department name is required.");
      return;
    }

    setAddSubmitting(true);
    setAddError(null);

    try {
      const session = buildSessionContext();
      if (!session.subInstituteId) {
        throw new Error("Current session is missing sub institute id.");
      }

      await createDepartment(session, {
        department: name,
        parentId: addParent?.apiId ?? 0,
      });

      setAddDialogOpen(false);
      setActionNotice({
        type: "success",
        message: addParent
          ? "Sub-department added successfully."
          : "Department added successfully.",
      });
      await fetchDepartments(undefined, false);
    } catch (err) {
      setAddError(
        err instanceof Error ? err.message : "Could not add department."
      );
    } finally {
      setAddSubmitting(false);
    }
  }

  function openEditDialog(row: ListRow) {
    setEditTarget(row);
    setEditName(row.name);
    setEditError(null);
    setEditDialogOpen(true);
  }

  async function submitEdit() {
    if (!editTarget) return;
    const name = editName.trim();
    if (!name) {
      setEditError("Department name is required.");
      return;
    }

    setEditSubmitting(true);
    setEditError(null);

    try {
      const session = buildSessionContext();
      if (!session.subInstituteId) {
        throw new Error("Current session is missing sub institute id.");
      }

      await updateDepartment(session, editTarget.apiId, { department: name });

      setEditDialogOpen(false);
      setActionNotice({
        type: "success",
        message:
          editTarget.parent !== "-"
            ? "Sub-department updated successfully."
            : "Department updated successfully.",
      });
      await fetchDepartments(undefined, false);
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : "Could not update department."
      );
    } finally {
      setEditSubmitting(false);
    }
  }

  function openDeleteDialog(row: ListRow) {
    setDeleteTarget(row);
    setDeleteError(null);
    setDeleteDialogOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    setDeleteSubmitting(true);
    setDeleteError(null);

    try {
      const session = buildSessionContext();
      if (!session.subInstituteId) {
        throw new Error("Current session is missing sub institute id.");
      }

      await deleteDepartment(session, deleteTarget.apiId);

      setDeleteDialogOpen(false);
      setActionNotice({
        type: "success",
        message:
          deleteTarget.parent !== "-"
            ? "Sub-department removed successfully."
            : "Department removed successfully.",
      });
      if (selectedId === deleteTarget.id) {
        setSelectedId(null);
      }
      setDeleteTarget(null);
      await fetchDepartments(undefined, false);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Could not delete department."
      );
    } finally {
      setDeleteSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex h-[calc(100vh-12px)] min-h-[570px] items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
          <p className="text-[12px] font-medium text-muted-foreground">
            Loading departments…
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex h-[calc(100vh-12px)] min-h-[570px] items-center justify-center bg-background text-foreground">
        <div className="flex max-w-sm flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-card px-6 py-8 text-center shadow-sm">
          <X className="h-6 w-6 text-destructive" />
          <p className="text-[12px] font-semibold text-foreground">
            Could not load departments
          </p>
          <p className="text-[11px] leading-4 text-muted-foreground">{error}</p>
          <Button
            type="button"
            className="bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="flex h-[calc(100vh-12px)] min-h-[640px] flex-col gap-4 overflow-hidden p-4 text-foreground">
        <Breadcrumb />

        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Department Management
              </h1>
              <Info className="h-4 w-4 text-blue-600" aria-hidden="true" />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage and organize departments and departmental hierarchy.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              size="lg"
              className="bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => openAddDialog()}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Department
            </Button>
            <Button type="button" variant="outline" size="lg">
              <Download className="h-4 w-4" aria-hidden="true" />
              Export
            </Button>
          </div>
        </div>

        {actionNotice ? (
          <div
            className={cn(
              "flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-[12px] font-medium",
              actionNotice.type === "success"
                ? "border-success/30 bg-success/10 text-success"
                : "border-destructive/30 bg-destructive/10 text-destructive"
            )}
          >
            <span>{actionNotice.message}</span>
            <button
              type="button"
              onClick={() => setActionNotice(null)}
              aria-label="Dismiss"
              className="shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}

        <div
          className={cn(
            "grid min-h-0 flex-1 gap-3",
            showDetails
              ? "grid-cols-[280px_minmax(0,1fr)_320px]"
              : "grid-cols-[280px_minmax(0,1fr)]"
          )}
        >
          <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <PanelHeader title="Department Hierarchy" />
            <div className="border-b border-border px-4 pb-4">
              <SearchField value={treeQuery} onChange={setTreeQuery} />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              {hierarchy.length === 0 ? (
                <p className="px-2 py-4 text-[11px] text-muted-foreground">
                  No departments available.
                </p>
              ) : (
                hierarchy.map((node) => (
                  <HierarchyItem
                    key={node.id}
                    node={node}
                    level={0}
                    collapsedIds={collapsedIds}
                    selectedId={selectedId ?? ""}
                    query={treeQuery}
                    onToggle={handleToggle}
                    onSelect={selectFromHierarchy}
                  />
                ))
              )}
            </div>
            <div className="grid grid-cols-4 border-t border-border p-3">
              <FooterIcon
                label={selectedRow ? "Add sub-department" : "Add department"}
                icon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => openAddDialog(selectedRow)}
              />
              <FooterIcon
                label="Move up"
                icon={<ChevronDown className="h-3.5 w-3.5 rotate-180" />}
              />
              <FooterIcon label="Move down" icon={<ChevronDown className="h-3.5 w-3.5" />} />
              <FooterIcon
                label="Hierarchy settings"
                icon={<ChevronsUpDown className="h-3.5 w-3.5" />}
              />
            </div>
          </section>

          <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <PanelHeader
              title={`Department List (${filteredDepartments.length})`}
              action={
                hierarchyFilter ? (
                  <button
                    type="button"
                    onClick={clearHierarchyFilter}
                    className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-100"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                    Clear filter
                  </button>
                ) : null
              }
            />
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] items-center gap-2 border-b border-border px-4 pb-4">
              <SearchField
                value={query}
                onChange={(value) => {
                  setQuery(value);
                  setPage(1);
                }}
              />
              <label className="relative">
                <select
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value);
                    setPage(1);
                  }}
                  className="h-9 appearance-none rounded-md border border-input bg-background px-2.5 pr-8 text-[12px] text-foreground outline-none focus-visible:border-ring"
                >
                  <option value="All">Status: All</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Pending">Pending</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              </label>
              <label className="relative">
                <select
                  value={parentFilter}
                  onChange={(event) => {
                    setParentFilter(event.target.value);
                    setPage(1);
                  }}
                  className="h-9 appearance-none rounded-md border border-input bg-background px-2.5 pr-8 text-[12px] text-foreground outline-none focus-visible:border-ring"
                >
                  <option value="All">Parent Department: All</option>
                  <option value="Root">Root Departments</option>
                  {parentOptions.map((parent) => (
                    <option key={parent} value={parent}>
                      {parent}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              </label>
              <Button type="button" variant="outline">
                <Filter className="h-3.5 w-3.5" />
                Filters
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Refresh"
                onClick={() => fetchDepartments(undefined, false)}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <Table className="w-full min-w-[820px]">
                <TableHeader className="sticky top-0 z-10 bg-muted">
                  <TableRow className="hover:bg-muted">
                    <SortHead label="Department" sortKey="name" activeKey={sortKey} asc={sortAsc} onSort={toggleSort} className="whitespace-nowrap px-3.5" />
                    <SortHead label="Code" sortKey="code" activeKey={sortKey} asc={sortAsc} onSort={toggleSort} className="whitespace-nowrap px-2" />
                    <SortHead label="Parent" sortKey="parent" activeKey={sortKey} asc={sortAsc} onSort={toggleSort} className="whitespace-nowrap px-2" />
                    <SortHead label="Head" sortKey="head" activeKey={sortKey} asc={sortAsc} onSort={toggleSort} className="whitespace-nowrap px-2" />
                    <SortHead label="Employees" sortKey="employees" activeKey={sortKey} asc={sortAsc} onSort={toggleSort} className="whitespace-nowrap px-3 text-center" />
                    <SortHead label="Status" sortKey="status" activeKey={sortKey} asc={sortAsc} onSort={toggleSort} className="whitespace-nowrap px-3" />
                    <TableHead className="whitespace-nowrap px-2 text-center normal-case">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={7} className="h-[120px] text-center text-[11px] text-muted-foreground">
                        No departments match the current filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageRows.map((department) => {
                      const isSubDepartment = department.parent !== "-";
                      return (
                        <TableRow
                          key={department.id}
                          onClick={() => selectRow(department.id)}
                          className={cn(
                            "cursor-pointer",
                            selectedId === department.id && "bg-blue-50 hover:bg-blue-50"
                          )}
                        >
                          <TableCell className="max-w-[220px] truncate px-3.5 font-semibold text-foreground">
                            {department.name}
                          </TableCell>
                          <TableCell className="whitespace-nowrap px-2 font-semibold text-foreground">
                            {department.code}
                          </TableCell>
                          <TableCell className="max-w-[140px] px-2 text-muted-foreground">
                            <span className="block truncate">{department.parent}</span>
                          </TableCell>
                          <TableCell className="max-w-[180px] px-2">
                            <Person name={department.head} title={department.title} />
                          </TableCell>
                          <TableCell className="whitespace-nowrap px-3 text-center font-semibold text-foreground">
                            {department.employees}
                          </TableCell>
                          <TableCell className="whitespace-nowrap px-3">
                            <StatusBadge status={department.status} size="sm" />
                          </TableCell>
                          <TableCell className="whitespace-nowrap px-2 text-center">
                            <div className="flex items-center justify-center gap-0.5">
                              <IconAction label={`View ${department.name}`} icon={<Eye className="h-3.5 w-3.5" />} />
                              <IconAction
                                label={`Edit ${department.name}`}
                                icon={<Pencil className="h-3.5 w-3.5" />}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openEditDialog(department);
                                }}
                              />
                              <IconAction
                                label={`Delete ${department.name}`}
                                icon={<Trash2 className="h-3.5 w-3.5" />}
                                className="text-destructive"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openDeleteDialog(department);
                                }}
                              />
                              <div onClick={(event) => event.stopPropagation()}>
                                <RowMenu
                                  isSubDepartment={isSubDepartment}
                                  onEdit={() => openEditDialog(department)}
                                  onAddSubDepartment={() => openAddDialog(department)}
                                  onDelete={() => openDeleteDialog(department)}
                                />
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex h-[51px] items-center justify-between border-t border-border px-3.5">
              <p className="text-[11px] text-muted-foreground">
                Showing {filteredDepartments.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0} to{" "}
                {Math.min(currentPage * PAGE_SIZE, filteredDepartments.length)} of{" "}
                {filteredDepartments.length} entries
              </p>
              <div className="flex items-center gap-2">
                <PaginationButton
                  label="Previous page"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </PaginationButton>
                {Array.from({ length: totalPages }).map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setPage(index + 1)}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-md border text-[12px] font-semibold transition-colors",
                      currentPage === index + 1
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-border bg-background text-foreground hover:bg-muted"
                    )}
                  >
                    {index + 1}
                  </button>
                ))}
                <PaginationButton
                  label="Next page"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </PaginationButton>
              </div>
            </div>
          </section>

          {showDetails && selectedRow ? (
            <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="flex h-[50px] items-center justify-between border-b border-border px-3.5">
                <h2 className="text-[13px] font-semibold text-foreground">
                  Department Details
                </h2>
                <button
                  type="button"
                  onClick={handleCloseDetails}
                  className="px-3 py-2 text-foreground"
                  aria-label="Close details"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center gap-3 px-3.5 py-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                  <Folder className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate text-[13px] font-semibold text-foreground">
                      {selectedRow.name}
                    </h3>
                    <StatusBadge status={selectedRow.status} size="sm" />
                  </div>
                  <p className="mt-2 truncate text-[11px] text-muted-foreground">
                    {selectedRow.code} <span className="px-1">-</span> {selectedRow.parent}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 border-t border-border px-3.5 py-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => openEditDialog(selectedRow)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit {selectedRow.parent !== "-" ? "sub department" : "department"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => openAddDialog(selectedRow)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add sub department
                </Button>
              </div>
              <div className="border-t border-border px-3.5 py-3">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={() => openDeleteDialog(selectedRow)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove {selectedRow.parent !== "-" ? "sub department" : "department"}
                </Button>
              </div>

              <div className="grid h-9 grid-cols-4 border-y border-border">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "border-b-2 text-[11px] font-medium",
                      activeTab === tab
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-muted-foreground"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-5">
                {activeTab === "SOPs" ? (
                  <SopsModule departmentName={selectedRow.name} departmentId={selectedRow.apiId} />
                ) : activeTab === "Policies" ? (
                  <PoliciesModule departmentName={selectedRow.name} />
                ) : activeTab === "Rules" ? (
                  <RulesModule departmentName={selectedRow.name} />
                ) : activeTab === "Overview" ? (
                  <>
                    <div className="pt-1">
                      <DetailLine
                        icon={<UserRound className="h-3.5 w-3.5" />}
                        label="Department Head"
                        value={selectedRow.head === "-" ? "Unassigned" : selectedRow.head}
                        action="Change HOD"
                      />
                      <DetailLine
                        icon={<Folder className="h-3.5 w-3.5" />}
                        label="Parent Department"
                        value={selectedRow.parent}
                      />
                      <DetailLine
                        icon={<Users className="h-3.5 w-3.5" />}
                        label="Total Employees"
                        value={String(selectedRow.employees)}
                      />
                      <DetailLine
                        icon={<CalendarDays className="h-3.5 w-3.5" />}
                        label="Created On"
                        value={selectedRow.createdOn}
                      />
                      <DetailLine
                        icon={<RotateCcw className="h-3.5 w-3.5" />}
                        label="Last Updated"
                        value={selectedRow.updatedOn}
                      />
                    </div>
                    <div className="mt-4 border-t border-border pt-4">
                      <h4 className="mb-2 text-[12px] font-semibold text-foreground">
                        Description
                      </h4>
                      <p className="text-[11px] leading-[19px] text-muted-foreground">
                        {selectedRow.description}
                      </p>
                    </div>
                    <div className="mt-4 border-t border-border pt-4">
                      <h4 className="mb-2 text-[12px] font-semibold text-foreground">
                        Employees ({selectedRow.employees_list.length})
                      </h4>
                      {selectedRow.employees_list.length === 0 ? (
                        <p className="text-[11px] leading-5 text-muted-foreground">
                          No employees assigned to this department.
                        </p>
                      ) : (
                        <ul className="flex flex-col gap-2">
                          {selectedRow.employees_list.map((employee) => (
                            <li
                              key={employee.id}
                              className="flex items-center gap-2 rounded-md border border-border px-2.5 py-2"
                            >
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
                                {initials(employee.name)}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[11px] font-semibold text-foreground">
                                  {employee.name}
                                </span>
                                <span className="block truncate text-[10px] text-muted-foreground">
                                  Emp No: {employee.employee_no}
                                  {employee.gender ? ` • ${employee.gender}` : ""}
                                </span>
                              </span>
                              {employee.mobile && employee.mobile !== "-" ? (
                                <span className="shrink-0 text-[10px] text-muted-foreground">
                                  {employee.mobile}
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="mt-4 border-t border-border pt-4">
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-[12px] font-semibold text-foreground">
                          Sub Departments ({selectedRow.sub_departments.length})
                        </h4>
                        <button
                          type="button"
                          onClick={() => openAddDialog(selectedRow)}
                          className="text-[10px] font-medium text-blue-600"
                        >
                          Add sub-department
                        </button>
                      </div>
                      {selectedRow.sub_departments.length > 0 ? (
                        <ul className="flex flex-col gap-2">
                          {selectedRow.sub_departments.map((sub) => (
                            <li
                              key={sub.id}
                              className="flex items-center gap-2 rounded-md border border-border px-2.5 py-2"
                            >
                              <Folder className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                              <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-foreground">
                                {sub.name}
                              </span>
                              <Badge variant="secondary" className="rounded-full px-2">
                                {sub.total_employees} emp
                              </Badge>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[11px] leading-5 text-muted-foreground">
                          No sub-departments yet.
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="border-t border-border pt-4">
                    <p className="text-[11px] leading-5 text-muted-foreground">
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

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {addParent ? "Add sub-department" : "Add department"}
            </DialogTitle>
            {addParent ? (
              <DialogDescription>Parent department: {addParent.name}</DialogDescription>
            ) : null}
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-department-name" className="text-[11px] font-medium text-muted-foreground">
              Department name
            </label>
            <Input
              id="add-department-name"
              value={addName}
              onChange={(event) => setAddName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submitAdd();
              }}
              placeholder="e.g. Human Resources"
              className="h-9"
            />
            {addError ? (
              <p className="text-[11px] font-medium text-destructive">{addError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-blue-600 text-white hover:bg-blue-700"
              disabled={addSubmitting}
              onClick={submitAdd}
            >
              {addSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {addParent ? "Add sub-department" : "Add department"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Edit {editTarget && editTarget.parent !== "-" ? "sub-department" : "department"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-department-name" className="text-[11px] font-medium text-muted-foreground">
              Department name
            </label>
            <Input
              id="edit-department-name"
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submitEdit();
              }}
              className="h-9"
            />
            {editError ? (
              <p className="text-[11px] font-medium text-destructive">{editError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-blue-600 text-white hover:bg-blue-700"
              disabled={editSubmitting}
              onClick={submitEdit}
            >
              {editSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {deleteTarget && deleteTarget.parent !== "-" ? "sub-department" : "department"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && deleteTarget.parent !== "-"
                ? `Remove ${deleteTarget.name}? This action cannot be undone.`
                : `Remove ${deleteTarget?.name ?? "this department"} and its sub-departments? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? (
            <p className="text-[11px] font-medium text-destructive">{deleteError}</p>
          ) : null}
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={deleteSubmitting} onClick={confirmDelete}>
              {deleteSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Remove
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
