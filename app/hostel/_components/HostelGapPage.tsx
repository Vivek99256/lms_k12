"use client";

import Link from "next/link";
import { AlertTriangle, ArrowLeft, Database, FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function HostelGapPage({
  title,
  laravelSource,
  fields,
  notes,
  backendGaps,
}: {
  title: string;
  laravelSource: string;
  fields: string[];
  notes: string;
  backendGaps: string[];
}) {
  return (
    <main className="min-h-screen p-4 sm:p-6">
      <div className="mx-auto max-w-[1100px] space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">{title}</h1>
            <p className="mt-1 text-sm text-slate-500">
              This page was compared against the Laravel ERP, but the required backend API surface is not available in a token-safe form yet.
            </p>
          </div>
          <Link href="/hostel" className="inline-flex">
            <Button variant="outline">
              <ArrowLeft className="size-4" /> Back To Hostel
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="size-4 text-amber-600" /> Backend API Missing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-slate-600">{notes}</p>
            <div className="flex items-start gap-2 text-slate-600">
              <Database className="mt-0.5 size-4 text-slate-400" />
              <span>{laravelSource}</span>
            </div>
            <div>
              <p className="mb-2 font-medium text-slate-900">Laravel fields verified</p>
              <div className="flex flex-wrap gap-2">
                {fields.map((field) => (
                  <Badge key={field} variant="outline">{field}</Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 font-medium text-slate-900">Required backend work</p>
              <ul className="space-y-1 text-slate-600">
                {backendGaps.map((gap) => (
                  <li key={gap}>• {gap}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileSearch className="size-4 text-blue-600" /> Comparison Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p>Old Laravel ERP: inspected routes, controller logic, form fields, table columns, filters, and workflow behavior for this module.</p>
            <p>New Next.js ERP: no safe token-backed endpoint exists yet for full CRUD or report behavior, so the frontend cannot reproduce the Laravel behavior without backend work.</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
