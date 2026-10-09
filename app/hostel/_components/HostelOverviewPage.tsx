"use client";

import Link from "next/link";
import { CheckCircle2, Database, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const modules = [
  { title: "Visitor details", slug: "visitor-details", notes: "Visitor entry screen with create flow and live list." },
  { title: "Visitor report", slug: "visitor-report", notes: "Visitor list and reporting screen with date filters." },
  { title: "Hostel room allocation", slug: "hostel-room-allocation", notes: "Visible allocation page with filters, editable room assignment form, and results table." },
  { title: "Type master", slug: "type-master", notes: "Visible hostel type master with create, edit, delete, and list states." },
  { title: "Room type master", slug: "room-type-master", notes: "Visible room type master with create, edit, delete, and list states." },
  { title: "Admission category master", slug: "admission-category-master", notes: "Visible admission category master with create, edit, delete, and list states." },
  { title: "Hostel master", slug: "hostel-master", notes: "Visible hostel master with base fields, dynamic custom fields, and list state." },
  { title: "Building master", slug: "building-master", notes: "Visible building master with hostel dependency and list state." },
  { title: "Floor master", slug: "floor-master", notes: "Visible floor master with building dependency and list state." },
  { title: "Room master", slug: "room-master", notes: "Visible room master with floor dependency and allocated count." },
  { title: "Hostel report", slug: "hostel-report", notes: "Visible report page with filters, table output, and exports." },
  { title: "Available room report", slug: "available-room-report", notes: "Visible report page with filters, availability table, and exports." },
];

export function HostelOverviewPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">Hostel modules</h1>
            <p className="mt-1 text-sm text-slate-500">
              Hostel pages are available here using the existing ERP components and hostel setup APIs.
            </p>
          </div>
          <Badge variant="default" className="w-fit">12 Active Modules</Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="size-4 text-emerald-600" /> Frontend Visible</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold text-slate-950">{modules.length}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Database className="size-4 text-blue-600" /> Source Of Truth</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-600">Routes, controllers, models, Blade forms, filters, and report layouts from the old ERP were used to shape these pages.</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Link2 className="size-4 text-slate-600" /> Routing</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-600">All hostel pages are available from the menu.</CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {modules.map((module) => (
            <Card key={module.slug}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3 text-base">
                  <span>{module.title}</span>
                  <Badge variant="default">Active</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-slate-600">{module.notes}</p>
                <Link href={`/hostel/${module.slug}`} className="inline-flex">
                  <Button variant="outline">Open module</Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
