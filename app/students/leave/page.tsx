"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { DrawerIndentBackground } from "@base-ui/react";

type LeaveStatus = "pending" | "approved" | "rejected";

interface LeaveApplication {
  id: string;
  type: string;
  studentName: string;
  parentName: string;
  grade: string;
  section: string;
  submitted: string;
  dates: string;
  days: number;
  medicalProof: "Attached" | "Not required";
  reason: string;
  status: LeaveStatus;
}

const initialApplications: LeaveApplication[] = [
  {
    id: "1",
    type: "Sick leave",
    studentName: "Aarav Sharma",
    parentName: "Rakesh Sharma",
    grade: "Grade 6",
    section: "A",
    submitted: "02–4 Jul",
    dates: "02–4 Jul",
    days: 3,
    medicalProof: "Attached",
    reason: "Viral fever, doctor advised rest.",
    status: "pending",
  },
  {
    id: "2",
    type: "Casual leave",
    studentName: "Aryan Kapoor",
    parentName: "Shalini Kapoor",
    grade: "Grade 9",
    section: "A",
    submitted: "08 Jul",
    dates: "08 Jul",
    days: 1,
    medicalProof: "Not required",
    reason: "Sibling wedding.",
    status: "pending",
  },
  {
    id: "3",
    type: "Sick leave",
    studentName: "Ishaan Pillai",
    parentName: "Shalini Pillai",
    grade: "Grade 7",
    section: "A",
    submitted: "03–7 Jul",
    dates: "03–7 Jul",
    days: 5,
    medicalProof: "Attached",
    reason: "Chickenpox, contagious.",
    status: "pending",
  },
];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function StatusBadge({ status }: { status: LeaveStatus }) {
  const config = {
    pending: { label: "Pending", dot: "bg-amber-500", text: "text-amber-600" },
    approved: { label: "Approved", dot: "bg-emerald-500", text: "text-emerald-600" },
    rejected: { label: "Rejected", dot: "bg-rose-500", text: "text-rose-600" },
  }[status];

  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${config.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-sm text-slate-700">{value}</div>
    </div>
  );
}

function LeaveCard({
  application,
  onApprove,
  onReject,
}: {
  application: LeaveApplication;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const isDecided = application.status !== "pending";

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm rounded-[10px]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-slate-100 text-sm font-semibold text-slate-500">
            {getInitials(application.studentName)}
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900">
              {application.type} — {application.studentName}
            </h3>
            <p className="mt-0.5 text-sm text-slate-500">
              {application.parentName} · {application.grade} · {application.section} · Submitted{" "}
              {application.submitted}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <StatusBadge status={application.status} />
        </div>
      </div>
      <div className="flex items-start justify-between gap-4">
      <div className="flex flex-wrap mt-4 gap-1">
        <Field label="Dates" value={application.dates} />
        <Field label="Days" value={application.days} />
        <Field label="Medical proof" value={application.medicalProof} />
        <Field label="Reason" value={application.reason} />
      </div>
      <div className="flex items-center gap-2">
            <button
              onClick={() => onReject(application.id)}
              disabled={isDecided}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <X className="h-3.5 w-3.5" />
              Reject
            </button>
            <button
              onClick={() => onApprove(application.id)}
              disabled={isDecided}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-[#3a32b8] disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: "#453bdd" }}
            >
              <Check className="h-3.5 w-3.5" />
              Approve 
            </button>
          </div>
      </div>
    </div>
  );
}

export default function Page() {
  const [applications, setApplications] = useState<LeaveApplication[]>(initialApplications);

  const decidedCount = applications.filter((a) => a.status !== "pending").length;

  const updateStatus = (id: string, status: LeaveStatus) => {
    setApplications((prev) =>
      prev.map((app) => (app.id === id ? { ...app, status } : app))
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-full">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Leave applications</h1>
            <p className="mt-1 text-sm text-slate-500">
              Review and authorise student leave requests. Medical leave requires a verified
              certificate.
            </p>
          </div>
          <span className="whitespace-nowrap text-sm text-slate-400">
            {decidedCount} of {applications.length} decided
          </span>
        </div>

        <div className="mt-6 space-y-4">
          {applications.map((application) => (
            <LeaveCard
              key={application.id}
              application={application}
              onApprove={(id) => updateStatus(id, "approved")}
              onReject={(id) => updateStatus(id, "rejected")}
            />
          ))}
        </div>
      </div>
    </div>
  );
}