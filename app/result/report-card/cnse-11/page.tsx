'use client';

/**
 * CNSE class 11 report card — the legacy screen reuses the CBSE class 11
 * endpoint and layout, so this page shares the Cbse11ReportView renderer.
 */

import React, { useRef, useState } from 'react';
import { GraduationCap, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageHeader from '@/components/result/PageHeader';
import FilterBar, { type FilterFieldDef, type FilterValues } from '@/components/result/FilterBar';
import { Banner, TableSkeleton } from '@/components/result/primitives';
import { printElement } from '@/components/result/print';
import { resultPost } from '@/lib/result/api';
import Cbse11ReportView, { parseCbse11Students, type Cbse11Student } from '../cbse-11/Cbse11ReportView';

const FILTER_FIELDS: FilterFieldDef[] = [
  { kind: 'section', required: true },
  { kind: 'standard', required: true },
  { kind: 'division', required: true },
];

export default function Cnse11ReportCardPage() {
  const [students, setStudents] = useState<Cbse11Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handleSearch = async (values: FilterValues) => {
    const flat: Record<string, string> = {};
    for (const [key, value] of Object.entries(values)) flat[key] = Array.isArray(value) ? value.join(',') : value;
    setLoading(true);
    setError(null);
    try {
      const payload = await resultPost('result/cbse_11_t2_result/show_result', flat);
      setStudents(parseCbse11Students(payload));
    } catch (err) {
      setStudents([]);
      setError(err instanceof Error ? err.message : 'Failed to load report cards.');
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto space-y-6">
        <PageHeader
          icon={GraduationCap}
          title="CNSE class 11 report card"
          subtitle="Unit tests, half-yearly, practical and yearly exam report cards"
          breadcrumbs={[{ label: 'Result', href: '/result' }, { label: 'Reports' }, { label: 'CNSE class 11 report card' }]}
        />

        <Banner tone="info">CNSE results reuse the CBSE class 11 layout.</Banner>

        <FilterBar fields={FILTER_FIELDS} onSearch={(values) => void handleSearch(values)} loading={loading} />

        {error && <Banner tone="error">{error}</Banner>}

        {searched && !error && (
          <Card className="border-slate-200/80 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 px-6 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2.5 text-base font-bold text-slate-800">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <GraduationCap className="h-4 w-4" />
                  </div>
                  Report cards {students.length > 0 && `(${students.length})`}
                </CardTitle>
                {students.length > 0 && (
                  <Button
                    onClick={() => printElement(printRef.current, 'CNSE class 11 report card')}
                    className="h-9 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    <Printer className="h-4 w-4" />
                    Print result
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {loading ? (
                <TableSkeleton columns={8} />
              ) : (
                <div ref={printRef}>
                  <Cbse11ReportView students={students} />
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
