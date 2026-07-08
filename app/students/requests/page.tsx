"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { DrawerIndentBackground } from "@base-ui/react";

type RequestStatus = "pending" | "approved" | "rejected";

interface StudentRequest {
  id: string;
  type: string;
  studentName: string;
  parentName: string;
  grade: string;
  section: string;
  admissionId: string;
  field: string;
  fromValue: string;
  toValue: string;
  proof: string;
  status: RequestStatus;
}

const initialRequests: StudentRequest[] = [
  {
    id: "1",
    type: "Name correction",
    studentName: "Pari Menon",
    parentName: "Manoj Menon",
    grade: "Grade 10",
    section: "A",
    admissionId: "ADM-2026-0425",
    field: "Legal name spelling",
    fromValue: "Arjun Reddy",
    toValue: "Arjun Reddi",
    proof: "Aadhaar card",
    status: "pending",
  },
  {
    id: "2",
    type: "Address change",
    studentName: "Diya Rao",
    parentName: "Shalini Rao",
    grade: "Grade 6",
    section: "B",
    admissionId: "ADM-2026-0436",
    field: "Residential address",
    fromValue: "Sector 4",
    toValue: "Sector 19",
    proof: "Utility bill",
    status: "pending",
  },
  {
    id: "3",
    type: "Guardian update",
    studentName: "Kabir Verma",
    parentName: "Rekha Verma",
    grade: "Grade 8",
    section: "B",
    admissionId: "ADM-2026-0448",
    field: "Primary guardian phone",
    fromValue: "+91 98...",
    toValue: "+91 99...",
    proof: "Self-declaration",
    status: "pending",
  },
  {
    id: "4",
    type: "Date of birth",
    studentName: "Rohan Menon",
    parentName: "",
    grade: "",
    section: "",
    admissionId: "",
    field: "Date of birth",
    fromValue: "",
    toValue: "",
    proof: "",
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

function StatusBadge({ status }: { status: RequestStatus }) {
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

function RequestCard({
  request,
  onApprove,
  onReject,
}: {
  request: StudentRequest;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const isDecided = request.status !== "pending";

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm rounded-[10px]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-slate-100 text-sm font-semibold text-slate-500">
            {getInitials(request.studentName)}
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900">
              {request.type} — {request.studentName}
            </h3>
            <p className="mt-0.5 text-sm text-slate-500">
              {request.parentName && `${request.parentName} · `}
              {request.grade && `${request.grade} · `}
              {request.section && `${request.section} · `}
              {request.admissionId && request.admissionId}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <StatusBadge status={request.status} />
        </div>
      </div>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-wrap mt-4 gap-4">
          {request.field && <Field label="Field" value={request.field} />}
          {request.fromValue && <Field label="From" value={request.fromValue} />}
          {request.toValue && <Field label="To" value={request.toValue} />}
          {request.proof && <Field label="Proof" value={request.proof} />}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onReject(request.id)}
            disabled={isDecided}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="h-3.5 w-3.5" />
            Reject
          </button>
          <button
            onClick={() => onApprove(request.id)}
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
  const [requests, setRequests] = useState<StudentRequest[]>(initialRequests);

  const decidedCount = requests.filter((a) => a.status !== "pending").length;

  const updateStatus = (id: string, status: RequestStatus) => {
    setRequests((prev) =>
      prev.map((req) => (req.id === id ? { ...req, status } : req))
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-full">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Student change requests</h1>
            <p className="mt-1 text-sm text-slate-500">
              Data-correction requests routed for approval. Approving updates the master record with an audit trail.
            </p>
          </div>
          <span className="whitespace-nowrap text-sm text-slate-400">
            {decidedCount} of {requests.length} decided
          </span>
        </div>

        <div className="mt-6 space-y-4">
          {requests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              onApprove={(id) => updateStatus(id, "approved")}
              onReject={(id) => updateStatus(id, "rejected")}
            />
          ))}
        </div>
      </div>
    </div>
  );
}