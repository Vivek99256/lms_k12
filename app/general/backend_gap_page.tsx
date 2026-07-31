"use client";

import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type BackendGapPageProps = {
  title: string;
  description: string;
  expectedEndpoint?: string;
  laravelController?: string;
};

export function BackendGapPage({ title, description, expectedEndpoint, laravelController }: BackendGapPageProps) {
  return (
    <main className="min-h-screen p-4 sm:p-6">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <Card className="bg-amber-50 border-amber-200 shadow-sm">
          <CardHeader className="border-b border-amber-200">
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="size-5" />
              Backend API Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-amber-900">
            <p>
              This module exists in the old Laravel ERP but does not have a stateless API endpoint
              that the Next.js frontend can consume. The frontend cannot call session-based web
              routes directly.
            </p>
            {laravelController && (
              <div>
                <span className="font-semibold">Laravel Controller:</span>{" "}
                <code className="rounded bg-amber-100 px-1 py-0.5">{laravelController}</code>
              </div>
            )}
            {expectedEndpoint && (
              <div>
                <span className="font-semibold">Expected Endpoint:</span>{" "}
                <code className="rounded bg-amber-100 px-1 py-0.5">{expectedEndpoint}</code>
              </div>
            )}
            <p>
              To enable this page, a new API controller and route must be added in the Laravel
              backend, or the existing web controller must be wrapped with a stateless JSON entry
              point.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
