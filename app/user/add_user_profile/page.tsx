"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LoaderCircle, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteProfile, loadProfiles, saveProfile, type PermissionSet, type UserProfile } from "../api";

const noRights: PermissionSet = { view:false, add:false, edit:false, delete:false, admin:false };
const selectClass = "h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";
const empty = { name:"", description:"", parentId:0, sortOrder:0 };

export default function UserProfilesPage() {
  const [profiles,setProfiles]=useState<UserProfile[]>([]); const [rights,setRights]=useState(noRights);
  const [form,setForm]=useState(empty); const [editing,setEditing]=useState<UserProfile|null>(null); const [open,setOpen]=useState(false);
  const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [error,setError]=useState(""); const [notice,setNotice]=useState(""); const [search,setSearch]=useState("");
  const load=useCallback(async()=>{setLoading(true);setError("");try{const data=await loadProfiles();setProfiles(data.profiles);setRights(data.permissions);}catch(value:unknown){setError(value instanceof Error?value.message:"Profiles could not be loaded.");}finally{setLoading(false);}},[]);
  useEffect(()=>{
    // Authenticated browser storage supplies the ERP API session.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  },[load]);
  const visible=useMemo(()=>{const q=search.toLowerCase().trim();return !q?profiles:profiles.filter(p=>[p.name,p.description].some(v=>v.toLowerCase().includes(q)));},[profiles,search]);
  function create(){setEditing(null);setForm(empty);setOpen(true);}
  function edit(p:UserProfile){setEditing(p);setForm({name:p.name,description:p.description,parentId:p.parentId,sortOrder:p.sortOrder});setOpen(true);}
  function close(){setOpen(false);setEditing(null);setForm(empty);}
  async function submit(e:React.FormEvent){e.preventDefault();setSaving(true);setError("");setNotice("");try{setNotice(await saveProfile(form,editing?.id));close();await load();}catch(value:unknown){setError(value instanceof Error?value.message:"Profile could not be saved.");}finally{setSaving(false);}}
  async function remove(p:UserProfile){if(!window.confirm(`Delete profile ${p.name}?`))return;setSaving(true);setError("");try{setNotice(await deleteProfile(p.id));await load();}catch(value:unknown){setError(value instanceof Error?value.message:"Profile could not be deleted.");}finally{setSaving(false);}}
  return <main className="mx-auto space-y-5 p-4 sm:p-6">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-bold text-slate-900">User profiles</h1><p className="text-sm text-slate-500">Manage role hierarchy and display order.</p></div>{rights.add&&!open?<Button onClick={create}><Plus className="size-4"/>Add profile</Button>:null}</header>
    {error?<div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>:null}{notice?<div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div>:null}
    {open?<form onSubmit={submit} className="rounded-xl border bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">{editing?"Edit profile":"New profile"}</h2><Button type="button" size="icon" variant="ghost" onClick={close}><X className="size-4"/></Button></div><div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></div>
      <div className="space-y-2"><Label>Description *</Label><Input value={form.description} onChange={e=>setForm({...form,description:e.target.value})} required/></div>
      <div className="space-y-2"><Label>Parent profile</Label><select className={selectClass} value={form.parentId} onChange={e=>setForm({...form,parentId:Number(e.target.value)})}><option value={0}>Select parent profile</option>{profiles.filter(p=>p.id!==editing?.id&&p.parentId===0).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      <div className="space-y-2"><Label>Sort order *</Label><Input type="number" min={0} value={form.sortOrder} onChange={e=>setForm({...form,sortOrder:Number(e.target.value)})} required/></div>
    </div><div className="mt-5 flex justify-end gap-2"><Button type="button" variant="outline" onClick={close}>Cancel</Button><Button type="submit" disabled={saving}>{saving?<LoaderCircle className="size-4 animate-spin"/>:null}Save profile</Button></div></form>:null}
    <section className="rounded-xl border bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><Search className="size-4 text-slate-400"/><Input className="max-w-sm" placeholder="Search profiles" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Description</TableHead><TableHead>Parent</TableHead><TableHead>Sort order</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>
      {loading?<TableRow><TableCell colSpan={6} className="h-24 text-center"><LoaderCircle className="mx-auto size-5 animate-spin"/></TableCell></TableRow>:visible.length?visible.map(p=><TableRow key={p.id}><TableCell>{p.name}</TableCell><TableCell>{p.description}</TableCell><TableCell>{profiles.find(x=>x.id===p.parentId)?.name||"—"}</TableCell><TableCell>{p.sortOrder}</TableCell><TableCell>{p.status===1?"Active":"Inactive"}</TableCell><TableCell><div className="flex gap-1">{rights.edit?<Button size="icon" variant="ghost" onClick={()=>edit(p)} aria-label="Edit profile"><Pencil className="size-4"/></Button>:null}{rights.delete?<Button size="icon" variant="ghost" onClick={()=>void remove(p)} aria-label="Delete profile"><Trash2 className="size-4 text-red-600"/></Button>:null}</div></TableCell></TableRow>):<TableRow><TableCell colSpan={6} className="h-24 text-center text-slate-500">No profiles found.</TableCell></TableRow>}
    </TableBody></Table></div></section>
  </main>;
}
