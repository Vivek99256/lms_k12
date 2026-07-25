"use client";

import { Paperclip } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { RecordColumn } from "@/components/erp/RecordTable";
import { formatDisplayDate } from "../_lib/dates";
import { DEFAULT_COMPLAINT_SOLUTION, type ComplaintRecord } from "../_lib/complaint";

/** Column set shared by Complaint management and Complaint report. */
export function complaintColumns(): Array<RecordColumn<ComplaintRecord>> {
  return [
    { key: "title", label: "Title", value: (row) => row.title },
    { key: "description", label: "Description", value: (row) => row.description },
    { key: "date", label: "Date", value: (row) => formatDisplayDate(row.date) },
    { key: "complaint_by", label: "Complaint by", value: (row) => row.complaintBy },
    {
      key: "solution",
      label: "Solution",
      value: (row) => row.solution || DEFAULT_COMPLAINT_SOLUTION,
      render: (row) => {
        const solution = row.solution || DEFAULT_COMPLAINT_SOLUTION;
        const resolved = solution.toUpperCase() !== DEFAULT_COMPLAINT_SOLUTION;
        return <Badge variant={resolved ? "default" : "secondary"}>{solution}</Badge>;
      },
    },
    { key: "solution_by", label: "Solution by", value: (row) => row.solutionBy },
    {
      key: "attachment",
      label: "Attachment",
      value: (row) => row.attachment,
      sortable: false,
      render: (row) =>
        row.attachment ? (
          <span className="inline-flex items-center gap-1 text-slate-600">
            <Paperclip className="size-3.5" />
            <span className="font-mono text-xs">{row.attachment}</span>
          </span>
        ) : (
          "—"
        ),
    },
  ];
}
