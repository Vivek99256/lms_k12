"use client";

import { useMemo, useState } from "react";
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

type Department = {
  id: string;
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
};

type HierarchyNode = {
  name: string;
  count: number;
  children?: HierarchyNode[];
};

const departments: Department[] = [
  {
    id: "cs",
    name: "Customer Success",
    shortName: "Customer Suc...",
    code: "CS",
    parent: "Sales & Marketing",
    head: "Anita Desai",
    title: "Success Lead",
    employees: 64,
    status: "Active",
    createdOn: "Jan 18, 2016",
    updatedOn: "08 Jun 2025",
    description:
      "Supports customer engagement, onboarding, and post-sale service operations across GapstoGrowth Technologies.",
  },
  {
    id: "eng",
    name: "Engineering",
    shortName: "Engineering",
    code: "ENG",
    parent: "Executive Office",
    head: "Sanjay Kapoor",
    title: "CTO",
    employees: 486,
    status: "Active",
    createdOn: "Feb 14, 2012",
    updatedOn: "12 Jun 2025",
    description:
      "Owns platform engineering, quality assurance, product infrastructure, and technical delivery practices.",
  },
  {
    id: "exo",
    name: "Executive Office",
    shortName: "Executive Office",
    code: "EXO",
    parent: "-",
    head: "Avin Mehta",
    title: "CEO",
    employees: 8,
    status: "Active",
    createdOn: "Apr 01, 2011",
    updatedOn: "18 Jun 2025",
    description:
      "Leads organizational strategy, leadership governance, and executive operating rhythms.",
  },
  {
    id: "fin",
    name: "Finance & Accounts",
    shortName: "Finance & Accou...",
    code: "FIN",
    parent: "Executive Office",
    head: "Rohit Sharma",
    title: "CFO",
    employees: 38,
    status: "Active",
    createdOn: "May 09, 2014",
    updatedOn: "30 May 2025",
    description:
      "Handles finance & accounts functions including planning, operations, governance, and team support across GapstoGrowth Technologies.",
  },
  {
    id: "hr",
    name: "Human Resources",
    shortName: "Human Resources",
    code: "HR",
    parent: "Executive Office",
    head: "Priya Nair",
    title: "CHRO",
    employees: 42,
    status: "Active",
    createdOn: "Aug 11, 2013",
    updatedOn: "09 Jun 2025",
    description:
      "Manages people operations, hiring, employee policy, and learning support for all departments.",
  },
  {
    id: "sec",
    name: "Information Security",
    shortName: "Information Se...",
    code: "SEC",
    parent: "Engineering",
    head: "Kabir Khan",
    title: "Security Lead",
    employees: 22,
    status: "Inactive",
    createdOn: "Sep 22, 2017",
    updatedOn: "21 May 2025",
    description:
      "Oversees security governance, access controls, compliance support, and risk management.",
  },
  {
    id: "legal",
    name: "Legal & Compliance",
    shortName: "Legal & Compliance",
    code: "LGL",
    parent: "Executive Office",
    head: "Unassigned",
    title: "Open",
    employees: 12,
    status: "Pending",
    createdOn: "Nov 03, 2018",
    updatedOn: "24 May 2025",
    description:
      "Coordinates legal documentation, regulatory reviews, and compliance processes.",
  },
  {
    id: "platform",
    name: "Platform Engineering",
    shortName: "Platform Engi...",
    code: "PLT",
    parent: "Engineering",
    head: "Nikhil Rao",
    title: "VP Engineering",
    employees: 124,
    status: "Active",
    createdOn: "Jun 12, 2015",
    updatedOn: "01 Jun 2025",
    description:
      "Builds core product platforms, developer tooling, and shared engineering services.",
  },
  {
    id: "qa",
    name: "Quality Assurance",
    shortName: "Quality Assura...",
    code: "QA",
    parent: "Engineering",
    head: "Meera Iyer",
    title: "QA Manager",
    employees: 76,
    status: "Active",
    createdOn: "Jul 26, 2015",
    updatedOn: "27 May 2025",
    description:
      "Maintains testing standards, release verification, and product quality processes.",
  },
  {
    id: "product",
    name: "Product Management",
    shortName: "Product Management",
    code: "PRD",
    parent: "Executive Office",
    head: "Rhea Sinha",
    title: "Product Lead",
    employees: 54,
    status: "Active",
    createdOn: "Mar 08, 2016",
    updatedOn: "07 Jun 2025",
    description:
      "Defines product direction, roadmap planning, market feedback, and delivery priorities.",
  },
  {
    id: "sales",
    name: "Sales & Marketing",
    shortName: "Sales & Marketing",
    code: "SM",
    parent: "Executive Office",
    head: "Vikram Shah",
    title: "Revenue Head",
    employees: 132,
    status: "Active",
    createdOn: "Oct 19, 2014",
    updatedOn: "15 Jun 2025",
    description:
      "Runs sales, brand, campaign, and market development functions.",
  },
  {
    id: "talent",
    name: "Talent Acquisition",
    shortName: "Talent Acquisiti...",
    code: "TAL",
    parent: "Human Resources",
    head: "Isha Jain",
    title: "Hiring Lead",
    employees: 18,
    status: "Active",
    createdOn: "Dec 13, 2019",
    updatedOn: "04 Jun 2025",
    description:
      "Owns recruiting, interview coordination, and hiring operations.",
  },
];

const hierarchy: HierarchyNode[] = [
  {
    name: "Executive Office",
    count: 11,
    children: [
      {
        name: "Human Resources",
        count: 42,
        children: [{ name: "Talent Acquisiti...", count: 18 }],
      },
      {
        name: "Engineering",
        count: 486,
        children: [
          { name: "Platform Engi...", count: 124 },
          { name: "Quality Assura...", count: 76 },
          { name: "Information Se...", count: 22 },
        ],
      },
      { name: "Product Management", count: 54 },
      {
        name: "Sales & Marketing",
        count: 132,
        children: [{ name: "Customer Suc...", count: 64 }],
      },
      { name: "Finance & Accou...", count: 38 },
      { name: "Legal & Compliance", count: 12 },
    ],
  },
];

const tabs = ["Overview", "SOPs", "Policies", "Rules"];

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
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={`relative block ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#51627a]" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search department..."
        className="h-8 w-full rounded-md border border-[#d7e0eb] bg-[#f9fbfe] pl-9 pr-9 text-[11px] text-[#1f3654] outline-none placeholder:text-[#5f6f85] focus:border-[#8ab3f5] focus:bg-white"
      />
      <Search className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#071225]" />
    </label>
  );
}

function HierarchyItem({
  node,
  level,
  selectedName,
  onSelect,
}: {
  node: HierarchyNode;
  level: number;
  selectedName: string;
  onSelect: (name: string) => void;
}) {
  const selected = node.name === selectedName;
  const hasChildren = Boolean(node.children?.length);

  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(node.name)}
        className={`group grid h-[31px] w-full grid-cols-[18px_16px_minmax(0,1fr)_auto_18px] items-center gap-1 rounded-md px-2 text-left text-[11px] font-medium text-[#061632] ${
          selected ? "bg-[#e8efff] text-[#0b4efb]" : "hover:bg-[#f4f7fb]"
        }`}
        style={{ paddingLeft: `${8 + level * 15}px` }}
      >
        <span className="flex h-4 w-4 items-center justify-center text-[#304a6c]">
          {hasChildren ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <span className="h-3.5 w-3.5" />
          )}
        </span>
        <Folder className="h-3.5 w-3.5 text-[#0d6efd]" />
        <span className="truncate">{node.name}</span>
        <span className="rounded-full border border-[#dce5ef] bg-[#f4f8fd] px-2 py-0.5 text-[10px] font-medium text-[#577092]">
          {node.count}
        </span>
        {selected ? (
          <MoreVertical className="h-3.5 w-3.5 text-[#061632]" />
        ) : (
          <span />
        )}
      </button>
      {hasChildren ? (
        <div className="relative">
          <span
            className="absolute bottom-1 top-0 w-px bg-[#c8d7e8]"
            style={{ left: `${41 + level * 15}px` }}
          />
          {node.children?.map((child) => (
            <HierarchyItem
              key={`${node.name}-${child.name}`}
              node={child}
              level={level + 1}
              selectedName={selectedName}
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

export default function DepartmentPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [parent, setParent] = useState("All");
  const [selectedId, setSelectedId] = useState("fin");
  const [activeTab, setActiveTab] = useState("Overview");
  const [showDetails, setShowDetails] = useState(false);

  const filteredDepartments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return departments.filter((department) => {
      const matchesSearch =
        !normalizedQuery ||
        department.name.toLowerCase().includes(normalizedQuery) ||
        department.code.toLowerCase().includes(normalizedQuery) ||
        department.parent.toLowerCase().includes(normalizedQuery);
      const matchesStatus = status === "All" || department.status === status;
      const matchesParent = parent === "All" || department.parent === parent;

      return matchesSearch && matchesStatus && matchesParent;
    });
  }, [parent, query, status]);

  const visibleDepartments = filteredDepartments.slice(0, 10);
  const selectedDepartment =
    departments.find((department) => department.id === selectedId) ??
    departments[0];
  const selectedHierarchyName = selectedDepartment
    ? selectedDepartment.shortName || selectedDepartment.name
    : "";
  const parentOptions = Array.from(
    new Set(departments.map((department) => department.parent).filter(Boolean))
  );

  return (
    <main className="h-[calc(100vh-12px)] min-h-[570px] overflow-hidden bg-[#f3f7fc] p-1.5 text-[#061632]">
      <div
        className={`grid h-full min-w-[1180px] gap-2 ${
          showDetails ? "grid-cols-[258px_minmax(620px,1fr)_288px]" : "grid-cols-[258px_minmax(620px,1fr)]"
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
            {hierarchy.map((node) => (
              <HierarchyItem
                key={node.name}
                node={node}
                level={0}
                selectedName={selectedHierarchyName}
                onSelect={(name) => {
                  const department = departments.find(
                    (item) =>
                      item.name === name ||
                      item.shortName === name ||
                      item.name.startsWith(name.replace("...", ""))
                  );
                  if (department) {
                    setSelectedId(department.id);
                    setShowDetails(true);
                  }
                }}
              />
            ))}
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
              Department List (12)
            </h1>
            <SearchField value={query} onChange={setQuery} />
            <div className="mt-2 grid grid-cols-[1fr_1fr_auto_auto] gap-2">
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
              <label className="relative">
                <select
                  value={parent}
                  onChange={(event) => setParent(event.target.value)}
                  className="h-8 w-full appearance-none rounded-md border border-[#d7e0eb] bg-white px-2.5 pr-8 text-[11px] text-[#061632] outline-none focus:border-[#8ab3f5]"
                >
                  <option value="All">Parent Department: All</option>
                  {parentOptions.map((option) => (
                    <option key={option} value={option}>
                      Parent Department: {option}
                    </option>
                  ))}
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
                  setParent("All");
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
                  <th className="w-[27%] px-3.5">
                    <span className="inline-flex items-center gap-1">
                      Department <ArrowUp className="h-2.5 w-2.5" />
                    </span>
                  </th>
                  <th className="w-[11%] px-2">Code</th>
                  <th className="w-[17%] px-2">Parent</th>
                  <th className="w-[19%] px-2">Head</th>
                  <th className="w-[9%] px-2 text-center">Employees</th>
                  <th className="w-[11%] px-2">Status</th>
                  <th className="w-[8%] px-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleDepartments.map((department) => (
                  <tr
                    key={department.id}
                    onClick={() => {
                      setSelectedId(department.id);
                      setShowDetails(true);
                    }}
                    className={`h-[55px] cursor-pointer border-b border-[#dfe7f0] text-[11px] ${
                      selectedId === department.id
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
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f0f3f7] text-[10px] font-medium text-[#64748b]">
                          {department.head
                            .split(" ")
                            .map((part) => part[0])
                            .join("")
                            .slice(0, 2)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-[#061632]">
                            {department.id === "fin"
                              ? "Rohit Shar..."
                              : department.id === "eng"
                                ? "Sanjay Ka..."
                                : department.head}
                          </span>
                          <span className="block truncate text-[10px] text-[#405275]">
                            {department.title}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="px-2 text-center font-semibold text-[#061632]">
                      {department.employees}
                    </td>
                    <td className="px-2">
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
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex h-[51px] items-center justify-between border-t border-[#dfe7f0] px-3.5">
            <p className="text-[11px] text-[#405275]">
              Showing 1 to 10 of 12 entries
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

        {showDetails ? (
          <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[#d4dee9] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
            <div className="flex h-[50px] items-center justify-between border-b border-[#e4ebf3] px-3.5">
              <h2 className="text-[13px] font-semibold text-[#061632]">
                Department Details
              </h2>
              <button
                type="button"
                onClick={() => setShowDetails(false)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-[#061632] hover:bg-[#f4f7fb]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
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
            <div className="min-h-0 flex-1 overflow-hidden px-3.5 py-5">
                {activeTab === "SOPs" ? (
                  <SopsModule />
                ) : activeTab === "Policies" ? (
                  <PoliciesModule />
                ) : activeTab === "Rules" ? (
                  <RulesModule />
                ) : activeTab === "Overview" ? (
                <>
                  <div className="border-t border-[#dfe7f0] pt-3">
                    <DetailLine
                      icon={<UserRound className="h-3.5 w-3.5" />}
                      label="Department Head"
                      value={
                        selectedDepartment.id === "fin"
                          ? "Rohit Sharma"
                          : selectedDepartment.head
                      }
                      action="Change HOD"
                    />
                    <DetailLine
                      icon={<Folder className="h-3.5 w-3.5" />}
                      label="Parent Department"
                      value={selectedDepartment.parent}
                      action="Change Parent"
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
