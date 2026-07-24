"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpDown, LoaderCircle, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deactivateUser, loadUsers, saveUser, type PermissionSet, type UserBootstrap, type UserForm, type UserRecord } from "../api";

const emptyBootstrap: UserBootstrap = { profiles: [], subjects: [], departments: [], jobTitles: [], employees: [], nameSuffixes: [], newEmployeeNo: "" };
const noPermissions: PermissionSet = { view: false, add: false, edit: false, delete: false, admin: false };
const emptyForm: UserForm = { nameSuffix: "", firstName: "", middleName: "", lastName: "", userName: "", email: "", mobile: "", gender: "", birthdate: "", address: "", city: "", state: "", pincode: "", userProfileId: 0, joinYear: "", password: "", totalLecture: null, subjectIds: [], jobtitleId: null, departmentId: null, employeeNo: "", qualification: "", occupation: "" };
const selectClass = "h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";
const PAGE_SIZE = 10;
type SortKey = "userName" | "firstName" | "email" | "mobile" | "profileName" | "status";

export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]); const [bootstrap, setBootstrap] = useState(emptyBootstrap);
  const [rights, setRights] = useState(noPermissions); const [form, setForm] = useState(emptyForm); const [editing, setEditing] = useState<UserRecord | null>(null);
  const [showForm, setShowForm] = useState(false); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("firstName"); const [sortAscending, setSortAscending] = useState(true); const [currentPage, setCurrentPage] = useState(1);
  const load = useCallback(async () => { setLoading(true); setError(""); try { const data = await loadUsers(); setUsers(data.users); setBootstrap(data.bootstrap); setRights(data.permissions); } catch (value: unknown) { setError(value instanceof Error ? value.message : "Users could not be loaded."); } finally { setLoading(false); } }, []);
  useEffect(() => {
    // Authenticated browser storage supplies the ERP API session.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const matches = !q ? users : users.filter((u) => [u.userName,u.firstName,u.middleName,u.lastName,u.email,u.mobile,u.profileName].some((v) => v.toLowerCase().includes(q)));
    return [...matches].sort((left, right) => {
      const leftValue = sortKey === "status" ? left.status : left[sortKey];
      const rightValue = sortKey === "status" ? right.status : right[sortKey];
      const result = typeof leftValue === "number" && typeof rightValue === "number"
        ? leftValue - rightValue
        : String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true, sensitivity: "base" });
      return sortAscending ? result : -result;
    });
  }, [search, sortAscending, sortKey, users]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, pageCount);
  const visibleUsers = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const teacherSelected = bootstrap.profiles.find((p) => p.id === form.userProfileId)?.name.toLowerCase() === "teacher";
  function change<K extends keyof UserForm>(key: K, value: UserForm[K]) { setForm((current) => ({ ...current, [key]: value })); }
  function sortBy(key: SortKey) { if (sortKey === key) setSortAscending((value) => !value); else { setSortKey(key); setSortAscending(true); } setCurrentPage(1); }
  function startCreate() { setEditing(null); setForm({ ...emptyForm, employeeNo: bootstrap.newEmployeeNo }); setShowForm(true); setError(""); }
  function startEdit(value: UserRecord) { setEditing(value); setForm({ ...value, password: "" }); setShowForm(true); setError(""); }
  function closeForm() { setShowForm(false); setEditing(null); setForm(emptyForm); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try { setNotice(await saveUser(form, editing?.id)); closeForm(); await load(); } catch (value: unknown) { setError(value instanceof Error ? value.message : "User could not be saved."); } finally { setSaving(false); }
  }
  async function deactivate(value: UserRecord) {
    if (!window.confirm(`Deactivate ${value.firstName} ${value.lastName}?`)) return;
    setSaving(true); setError(""); try { setNotice(await deactivateUser(value.id)); await load(); } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : "User could not be deactivated."); } finally { setSaving(false); }
  }
  return <main className="mx-auto space-y-5 p-4 sm:p-6">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-bold text-slate-900">User Master</h1><p className="text-sm text-slate-500">Manage staff accounts and access profiles.</p></div>{rights.add && !showForm ? <Button onClick={startCreate}><Plus className="size-4"/>Add user</Button> : null}</header>
    {error ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
    {notice ? <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div> : null}
    {showForm ? <form onSubmit={submit} className="space-y-5 rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between"><div><h2 className="font-semibold">{editing ? "Edit user" : "New user"}</h2><p className="text-sm text-slate-500">Fields marked required match the Laravel workflow.</p></div><Button type="button" variant="ghost" size="icon" onClick={closeForm}><X className="size-4"/></Button></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Suffix" required><select className={selectClass} value={form.nameSuffix} onChange={(e)=>change("nameSuffix",e.target.value)} required><option value="">Select</option>{bootstrap.nameSuffixes.map(value=><option key={value} value={value}>{value}</option>)}</select></Field>
        <Field label="First name" required><Input maxLength={100} value={form.firstName} onChange={(e)=>{ change("firstName",e.target.value); if(!editing) change("userName",`${e.target.value}_${form.lastName}`.toLowerCase()); }} required/></Field>
        <Field label="Middle name" required><Input maxLength={100} value={form.middleName} onChange={(e)=>change("middleName",e.target.value)} required/></Field>
        <Field label="Last name" required><Input maxLength={100} value={form.lastName} onChange={(e)=>{ change("lastName",e.target.value); if(!editing) change("userName",`${form.firstName}_${e.target.value}`.toLowerCase()); }} required/></Field>
        <Field label="Username" required><Input maxLength={100} value={form.userName} onChange={(e)=>change("userName",e.target.value)} required/></Field>
        <Field label="Email" required><Input type="email" maxLength={100} value={form.email} onChange={(e)=>change("email",e.target.value)} required/></Field>
        <Field label="Mobile" required><Input maxLength={50} value={form.mobile} onChange={(e)=>change("mobile",e.target.value)} required/></Field>
        <Field label="Gender" required><select className={selectClass} value={form.gender} onChange={(e)=>change("gender",e.target.value)} required><option value="">Select</option><option value="M">Male</option><option value="F">Female</option></select></Field>
        <Field label="Birth date" required><Input type="date" value={form.birthdate} onChange={(e)=>change("birthdate",e.target.value)} required/></Field>
        <Field label="User profile" required><select className={selectClass} value={form.userProfileId || ""} onChange={(e)=>change("userProfileId",Number(e.target.value))} required><option value="">Select</option>{bootstrap.profiles.filter(p=>p.status===1).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <Field label="Joining year" required><Input maxLength={50} value={form.joinYear} onChange={(e)=>change("joinYear",e.target.value)} required/></Field>
        <Field label={editing ? "New password" : "Password"} required={!editing}><Input type="password" minLength={6} maxLength={100} value={form.password} onChange={(e)=>change("password",e.target.value)} required={!editing}/></Field>
        <Field label="Employee number"><Input maxLength={20} value={form.employeeNo} onChange={(e)=>change("employeeNo",e.target.value)}/></Field>
        <Field label="Department"><select className={selectClass} value={form.departmentId ?? ""} onChange={(e)=>change("departmentId",e.target.value ? Number(e.target.value) : null)}><option value="">Select</option>{bootstrap.departments.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
        <Field label="Job title"><select className={selectClass} value={form.jobtitleId ?? ""} onChange={(e)=>change("jobtitleId",e.target.value ? Number(e.target.value) : null)}><option value="">Select</option>{bootstrap.jobTitles.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
        {teacherSelected ? <Field label="Total lectures"><Input type="number" min={0} value={form.totalLecture ?? ""} onChange={(e)=>change("totalLecture",e.target.value ? Number(e.target.value) : null)}/></Field> : null}
        <Field label="Subjects"><select multiple className={`${selectClass} min-h-28 py-2`} value={form.subjectIds.map(String)} onChange={(e)=>change("subjectIds",Array.from(e.target.selectedOptions, (option)=>Number(option.value)))}>{bootstrap.subjects.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
        <Field label="Qualification"><Input maxLength={50} value={form.qualification} onChange={(e)=>change("qualification",e.target.value)}/></Field>
        <Field label="Occupation"><Input maxLength={50} value={form.occupation} onChange={(e)=>change("occupation",e.target.value)}/></Field>
        <Field label="City"><Input maxLength={100} value={form.city} onChange={(e)=>change("city",e.target.value)}/></Field>
        <Field label="State"><Input maxLength={100} value={form.state} onChange={(e)=>change("state",e.target.value)}/></Field>
        <Field label="Pincode"><Input maxLength={50} value={form.pincode} onChange={(e)=>change("pincode",e.target.value)}/></Field>
        <div className="md:col-span-2 xl:col-span-4"><Field label="Address" required><Textarea maxLength={255} value={form.address} onChange={(e)=>change("address",e.target.value)} required/></Field></div>
      </div>
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={closeForm}>Cancel</Button><Button type="submit" disabled={saving}>{saving?<LoaderCircle className="size-4 animate-spin"/>:null}{editing?"Update user":"Save user"}</Button></div>
    </form> : null}
    <section className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2"><Search className="size-4 text-slate-400"/><Input className="max-w-sm" placeholder="Search users" value={search} onChange={(e)=>{setSearch(e.target.value);setCurrentPage(1);}}/></div>
      <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Id</TableHead><SortableHead label="Username" sortKey="userName" activeKey={sortKey} ascending={sortAscending} onSort={sortBy}/><SortableHead label="Name" sortKey="firstName" activeKey={sortKey} ascending={sortAscending} onSort={sortBy}/><SortableHead label="Email" sortKey="email" activeKey={sortKey} ascending={sortAscending} onSort={sortBy}/><SortableHead label="Mobile" sortKey="mobile" activeKey={sortKey} ascending={sortAscending} onSort={sortBy}/><SortableHead label="Profile" sortKey="profileName" activeKey={sortKey} ascending={sortAscending} onSort={sortBy}/><SortableHead label="Status" sortKey="status" activeKey={sortKey} ascending={sortAscending} onSort={sortBy}/><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>
        {loading ? <TableRow><TableCell colSpan={8} className="h-24 text-center"><LoaderCircle className="mx-auto size-5 animate-spin"/></TableCell></TableRow> : visibleUsers.length ? visibleUsers.map((u,index)=><TableRow key={u.id}><TableCell>{(safePage-1)*PAGE_SIZE+index+1}</TableCell><TableCell>{u.userName}</TableCell><TableCell>{[u.firstName,u.middleName,u.lastName].filter(Boolean).join(" ")}</TableCell><TableCell>{u.email}</TableCell><TableCell>{u.mobile}</TableCell><TableCell>{u.profileName}</TableCell><TableCell>{u.status===1?"Active":"Inactive"}</TableCell><TableCell><div className="flex gap-1">{rights.edit?<Button size="icon" variant="ghost" aria-label="Edit user" onClick={()=>startEdit(u)}><Pencil className="size-4"/></Button>:null}{rights.delete&&u.status===1?<Button size="icon" variant="ghost" aria-label="Deactivate user" onClick={()=>void deactivate(u)}><Trash2 className="size-4 text-red-600"/></Button>:null}</div></TableCell></TableRow>) : <TableRow><TableCell colSpan={8} className="h-24 text-center text-slate-500">No users found.</TableCell></TableRow>}
      </TableBody></Table></div>
      {!loading && filtered.length > 0 ? <div className="mt-4 flex flex-col items-center justify-between gap-3 border-t pt-4 text-sm text-slate-500 sm:flex-row"><span>Showing {(safePage-1)*PAGE_SIZE+1}–{Math.min(safePage*PAGE_SIZE,filtered.length)} of {filtered.length}</span><div className="flex gap-2"><Button type="button" variant="outline" size="sm" disabled={safePage===1} onClick={()=>setCurrentPage((page)=>Math.max(1,page-1))}>Previous</Button><span className="flex items-center px-2">Page {safePage} of {pageCount}</span><Button type="button" variant="outline" size="sm" disabled={safePage===pageCount} onClick={()=>setCurrentPage((page)=>Math.min(pageCount,page+1))}>Next</Button></div></div> : null}
    </section>
  </main>;
}
function Field({label,required,children}:{label:string;required?:boolean;children:React.ReactNode}) { return <div className="space-y-2"><Label>{label}{required?<span className="text-red-600"> *</span>:null}</Label>{children}</div>; }
function SortableHead({label,sortKey,activeKey,ascending,onSort}:{label:string;sortKey:SortKey;activeKey:SortKey;ascending:boolean;onSort:(key:SortKey)=>void}) {
  return <TableHead aria-sort={activeKey===sortKey?(ascending?"ascending":"descending"):"none"}><button type="button" className="flex items-center gap-1 font-medium" onClick={()=>onSort(sortKey)}>{label}<ArrowUpDown className="size-3.5" aria-hidden="true"/></button></TableHead>;
}
