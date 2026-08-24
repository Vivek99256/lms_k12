"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  CalendarDays,
  Check,
  ChevronDown,
  Italic,
  Lightbulb,
  List,
  RefreshCw,
  ShieldCheck,
  Underline,
  WandSparkles,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AiGeneratedDocumentSave } from "./ai-generation-drawer";
import { Tooltip } from "./ai-generation-drawer";

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (document: AiGeneratedDocumentSave) => void;
  departmentName?: string;
};

const sectionOptions = [
  "Purpose", "Records", "Scope", "Approval", "Responsibilities",
  "Review & Update", "Policy Statements (Procedure)", "Required Documents",
  "Compliance",
];

const initialContent = `Fee Collection Policy

1. Purpose
To ensure the process of collecting student fees is accurate, transparent, and completed on time.

2. Scope
This policy applies to all staff members involved in collecting student fees in the institution.

3. Responsibilities
• Fees Staff: Collect fees, issue receipts, and maintain accurate records.
• Accounts Department: Reconcile collections and ensure proper accounting.
• Management: Oversee policy compliance and approve exceptions.`;

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="block text-[12px] font-semibold text-[#111827]">{label}{required ? <span className="text-red-500"> *</span> : null}<span className="mt-1.5 block">{children}</span></label>;
}

function NativeSelect({ value, onChange, children }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <span className="relative block"><select value={value} onChange={onChange} className="h-10 w-full appearance-none rounded-lg border border-[#d7dfed] bg-white px-3 pr-9 text-[12px] font-normal text-[#111827] outline-none focus:border-[#7657f6]">{children}</select><ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4" /></span>;
}

export default function PolicyGenerationDialog({ open, onClose, onSave, departmentName }: Props) {
  const [mainDepartment, setMainDepartment] = useState(departmentName || "Fees");
  const [subDepartment, setSubDepartment] = useState("Fee Collection");
  const [title, setTitle] = useState("Fee Collection Policy");
  const [purpose, setPurpose] = useState("To ensure the process of collecting student fees is accurate, transparent, and completed on time.");
  const [roles, setRoles] = useState("");
  const [policyType, setPolicyType] = useState("New Policy");
  const [language, setLanguage] = useState("English");
  const [keywords, setKeywords] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("2025-06-01");
  const [owner, setOwner] = useState("Fees Manager (Jignesh Patel)");
  const [approver, setApprover] = useState("Finance Manager (Rakesh Shah)");
  const [version, setVersion] = useState("1.0");
  const [frequency, setFrequency] = useState("Yearly");
  const [standard, setStandard] = useState("Internal Policy");
  const [detail, setDetail] = useState("Detailed");
  const [tone, setTone] = useState("Professional");
  const [template, setTemplate] = useState("Company Standard");
  const [sections, setSections] = useState(sectionOptions);
  const [content, setContent] = useState(initialContent);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const generated = useMemo(() => `${title || "Policy"}\n\n${sections.map((section, index) => `${index + 1}. ${section}\n${index === 0 ? purpose : `This section defines ${section.toLowerCase()} for ${subDepartment || mainDepartment}.`}`).join("\n\n")}`, [mainDepartment, purpose, sections, subDepartment, title]);

  useEffect(() => {
    if (!hasGenerated) return;
    document.getElementById("policy-generated-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hasGenerated]);

  const control = "h-10 rounded-lg border-[#d7dfed] bg-white text-[12px] font-normal";
  const toggleSection = (section: string) => setSections((current) => current.includes(section) ? current.filter((item) => item !== section) : [...current, section]);

  const closeDrawer = () => {
    setHasGenerated(false);
    setIsGenerating(false);
    onClose();
  };

  const generatePolicy = () => {
    setIsGenerating(true);
    window.setTimeout(() => {
      setContent(generated);
      setHasGenerated(true);
      setIsGenerating(false);
    }, 350);
  };

  const savePolicy = () => {
    onSave({ title: title.trim(), description: content, status: "Draft", category: policyType });
    closeDrawer();
  };

  return <div className={`fixed inset-0 z-[80] transition ${open ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!open}>
    <div className={`absolute inset-0 bg-[#07142b]/30 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`} />
    <aside className={`absolute right-0 top-0 flex h-full w-full max-w-[1180px] flex-col overflow-hidden border-l border-[#cfd8e6] bg-white shadow-2xl transition-transform duration-300 ease-out sm:w-[94vw] xl:w-[82vw] ${open ? "translate-x-0" : "translate-x-full"}`} role="dialog" aria-modal="true" aria-label="AI Policy Generation drawer">
      <header className="flex items-start justify-between px-6 py-5">
        <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-9 w-9 text-[#7047f5]" /><div><h2 className="text-[22px] font-bold text-[#0b132b]">AI Policy Generation</h2><p className="text-[13px] text-[#15254b]">Generate, edit, and save department policies without leaving details.</p></div></div>
        <button type="button" onClick={closeDrawer} aria-label="Close" className="rounded-md p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
        <div className="grid min-w-[1050px] grid-cols-[320px_305px_minmax(550px,1fr)] gap-4">
          <section className="rounded-xl border border-[#d8e1ef] p-5">
            <h3 className="mb-4 text-[14px] font-semibold text-[#4e35ed]">1. Basic Information</h3>
            <div className="space-y-4">
              <Field label="Main Department" required><NativeSelect value={mainDepartment} onChange={(e) => setMainDepartment(e.target.value)}><option>{departmentName || "Fees"}</option><option>Finance</option><option>Administration</option></NativeSelect></Field>
              <Field label="Sub Department"><NativeSelect value={subDepartment} onChange={(e) => setSubDepartment(e.target.value)}><option>Fee Collection</option><option>Accounts</option><option>Operations</option></NativeSelect></Field>
              <Field label="Policy Title" required><Input value={title} onChange={(e) => setTitle(e.target.value)} className={control} /></Field>
              <Field label="Purpose / Short Description" required><Textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} className="min-h-[98px] rounded-lg border-[#d7dfed] text-[12px] font-normal leading-5" /></Field>
              <Field label="Applicable To (Roles/Users)" required><Input value={roles} onChange={(e) => setRoles(e.target.value)} placeholder="e.g. Fees Staff, Accounts Department, Front Office" className={control} /></Field>
              <Field label="Policy Type" required><NativeSelect value={policyType} onChange={(e) => setPolicyType(e.target.value)}><option>New Policy</option><option>Improve Existing Policy</option></NativeSelect></Field>
              <Field label="Language" required><NativeSelect value={language} onChange={(e) => setLanguage(e.target.value)}><option>English</option><option>Hindi</option><option>Gujarati</option></NativeSelect></Field>
              <Field label="Keywords"><Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="e.g. Fee Collection, Payment, Due Date, Late Fee" className={control} /></Field>
            </div>
          </section>

          <section className="rounded-xl border border-[#d8e1ef] p-5">
            <div className="space-y-5">
              <Field label="Effective Date" required><span className="relative block"><Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className={control} /><CalendarDays className="pointer-events-none absolute right-3 top-3 hidden h-4 w-4" /></span></Field>
              <Field label="Policy Owner" required><NativeSelect value={owner} onChange={(e) => setOwner(e.target.value)}><option>Fees Manager (Jignesh Patel)</option><option>Accounts Head (Neha Desai)</option></NativeSelect></Field>
              <Field label="Policy Approver" required><NativeSelect value={approver} onChange={(e) => setApprover(e.target.value)}><option>Finance Manager (Rakesh Shah)</option><option>Principal (Dr. Meena Joshi)</option><option>Director (Amit Patel)</option><option>Accounts Head (Neha Desai)</option></NativeSelect></Field>
              <Field label="Version"><Input value={version} onChange={(e) => setVersion(e.target.value)} className={control} /></Field>
              <Field label="Review Frequency"><NativeSelect value={frequency} onChange={(e) => setFrequency(e.target.value)}><option>Yearly</option><option>Half Yearly</option><option>Quarterly</option></NativeSelect></Field>
              <Field label="Compliance Standard"><NativeSelect value={standard} onChange={(e) => setStandard(e.target.value)}><option>Internal Policy</option><option>Regulatory</option><option>Industry Standard</option></NativeSelect></Field>
              <div className="rounded-lg border border-[#e5ddff] bg-[#f8f5ff] p-3 text-[11px] leading-5 text-[#303e68]"><strong className="block text-[12px] text-[#5435ed]">Mandatory Fields</strong>Fields marked with <span className="text-red-500">*</span> are mandatory for policy generation.</div>
            </div>
          </section>

          <div className="space-y-4">
            <section className="rounded-xl border border-[#d8e1ef] p-5">
              <h3 className="mb-4 text-[14px] font-semibold text-[#4e35ed]">2. AI Generation Options</h3>
              <div className="grid grid-cols-[170px_1fr] gap-3">
                <div className="space-y-4">
                  <Field label="Detail Level"><NativeSelect value={detail} onChange={(e) => setDetail(e.target.value)}><option>Detailed</option><option>Standard</option><option>Brief</option></NativeSelect><small className="mt-1.5 block font-normal leading-5 text-[#344a83]">Choose how detailed the policy should be.</small></Field>
                  <Field label="Policy Tone"><NativeSelect value={tone} onChange={(e) => setTone(e.target.value)}><option>Professional</option><option>Formal</option><option>Simple</option></NativeSelect><small className="mt-1.5 block font-normal leading-5 text-[#344a83]">Select the writing tone for the policy content.</small></Field>
                </div>
                <div><p className="mb-3 text-[12px] font-semibold">Include Sections</p>
                <div className="grid grid-cols-[max-content_max-content] gap-x-4 gap-y-2">
  {sectionOptions.map((section) => (
    <label
      key={section}
      className="flex cursor-pointer items-start gap-2 text-[11px] leading-5 text-[#293f7b]"
    >
      <input
        className="peer sr-only"
        type="checkbox"
        checked={sections.includes(section)}
        onChange={() => toggleSection(section)}
      />
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-[#5145e8] text-white peer-not-checked:bg-white peer-not-checked:ring-1 peer-not-checked:ring-[#b9c5d8]">
        <Check className="h-3 w-3" />
      </span>
      {section}
    </label>
  ))}
</div><div className="mt-4 flex items-start gap-2 rounded-lg border border-[#e3dcff] bg-[#f8f5ff] p-3 text-[10px] leading-5 text-[#5339e9]"><Lightbulb className="h-4 w-4 shrink-0" /><span><strong>Tip:</strong> More sections help generate a complete and professional policy.</span></div></div>
              </div>
            </section>

            {hasGenerated ? <section id="policy-generated-editor" className="overflow-visible rounded-xl border border-[#d8e1ef]">
              <div className="flex items-center justify-between px-5 py-3"><h3 className="text-[14px] font-semibold text-[#00a351]">3. AI-Generated Policy Editor</h3><div className="flex gap-2"><Button variant="outline" className="h-9 border-[#ded7ff] text-[11px]" onClick={() => setContent(`${content}\n\nImprovement Notes\nReview ownership, exceptions, and measurable compliance requirements.`)}><WandSparkles className="h-4 w-4 text-[#5c39ed]" />AI Improve</Button><Button variant="outline" className="h-9 border-[#ded7ff] text-[11px]" onClick={() => setContent(generated)}><RefreshCw className="h-4 w-4" />Regenerate</Button></div></div>
              <div className="mx-5 flex h-10 items-center gap-1 rounded-t-lg border border-[#d8e1ef] px-2 text-[#111827]"><select className="mr-2 h-7 rounded border border-[#e2e7ef] px-2 text-[11px]"><option>Normal</option><option>Heading</option></select>{[[Bold, "Bold"], [Italic, "Italic"], [Underline, "Underline"], [List, "List"], [AlignLeft, "Align left"], [AlignCenter, "Align center"], [AlignRight, "Align right"]].map(([Icon, label]) => { const ToolIcon = Icon as typeof Bold; return <Tooltip key={label as string} label={label as string}><button type="button" title={label as string} className="rounded p-1.5 hover:bg-slate-100"><ToolIcon className="h-4 w-4" /></button></Tooltip>; })}</div>
              <Textarea aria-label="Generated policy content" value={content} onChange={(e) => setContent(e.target.value)} className="mx-5 mb-5 min-h-[300px] w-[calc(100%-40px)] resize-none rounded-t-none border-[#d8e1ef] px-4 py-4 font-sans text-[12px] font-normal leading-6" />
            </section> : null}
          </div>
        </div>
      </div>

      <footer className="flex items-center justify-between border-t border-[#d8e1ef] px-4 py-2"><Button variant="outline" onClick={closeDrawer} className="h-10 min-w-24">Cancel</Button>{hasGenerated ? <Button onClick={savePolicy} className="h-10 min-w-52 bg-emerald-600 text-white hover:bg-emerald-700"><Check className="h-4 w-4" />Save Policy</Button> : <Button disabled={!title.trim() || !purpose.trim() || !roles.trim() || isGenerating} onClick={generatePolicy} className="h-10 min-w-52 bg-gradient-to-r from-[#6036e8] to-[#6e28e8] text-white hover:opacity-90"><WandSparkles className="h-4 w-4" />{isGenerating ? "Generating..." : "Generate Policy"}</Button>}</footer>
    </aside>
  </div>;
}
