'use client';

import Link from 'next/link';
import PageHeader from '@/components/result/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { reportConfigs } from './config';

export default function AdmissionReportsIndexPage() {
  return (
    <div className="min-h-screen bg-slate-50/40">
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6 lg:p-8">
        <PageHeader
          icon={reportConfigs[0].icon}
          title="Admission Reports"
          subtitle="Open each legacy-aligned admissions report from its own separate module file."
          breadcrumbs={[
            { label: 'Admissions', href: '/admissions/admission_enquiry' },
            { label: 'Admission Reports' },
          ]}
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {reportConfigs.map((report) => {
            const Icon = report.icon;

            return (
              <Link key={report.id} href={`/admissions/admission_reports/${report.slug}`} className="block">
                <Card className="h-full border-slate-200/80 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <CardContent className="flex h-full flex-col gap-4 p-5">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-base font-bold text-slate-900">{report.title}</h2>
                        <p className="mt-1 text-sm text-slate-500">{report.subtitle}</p>
                      </div>
                    </div>

                    <div className="mt-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Route</p>
                      <p className="mt-1 font-mono text-xs text-slate-700">
                        /admissions/admission_reports/{report.slug}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
