"use client";

// page.tsx
import React, { useEffect, useState } from 'react';
import DisciplineChart from './components/DisciplineChart';
import IncidentsTable from './components/IncidentsTable';
import MetricCard from './components/MetricCard';
import { Loader2, ShieldAlert, Ban, UserCheck, CheckCircle } from 'lucide-react';
import { getDisciplineData, type DisciplineMetrics } from './api';

export interface Incident {
  date: string;
  initials: string;
  name: string;
  grade: string;
  section: string;
  category: string;
  demeritPoints: number;
  status: 'Resolved' | 'Open' | 'Under review';
}

export default function DisciplineModulePage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [metrics, setMetrics] = useState<DisciplineMetrics>({
    incidentsThisTerm: 0,
    demeritPointsIssued: 0,
    studentsFlagged: 0,
    resolved: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    getDisciplineData(controller.signal)
      .then((result) => {
        setIncidents(result.incidents);
        setMetrics(result.metrics);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(reason instanceof Error ? reason.message : 'Unable to load discipline records.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading discipline records…
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 font-sans antialiased text-slate-600">

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Analytics Top Cards Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard title="Incidents this term" value={String(metrics.incidentsThisTerm)} icon={<ShieldAlert className="text-indigo-500" size={18} />} />
        <MetricCard title="Demerit points issued" value={String(metrics.demeritPointsIssued)} icon={<Ban className="text-indigo-500" size={18} />} />
        <MetricCard title="Students flagged" value={String(metrics.studentsFlagged)} icon={<UserCheck className="text-indigo-500" size={18} />} />
        <MetricCard title="Resolved" value={String(metrics.resolved)} icon={<CheckCircle className="text-indigo-500" size={18} />} />
      </div>

      {/* Demerit Points Horizontal Bar Analytics Chart */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm mb-6">
        <DisciplineChart />
      </div>

      {/* Recent Incidents Data Table Layout */}
      <IncidentsTable incidents={incidents} />
    </div>
  );
}
