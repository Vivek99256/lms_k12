"use client";
// page.tsx
<<<<<<< HEAD
import React, { useState } from 'react';
=======
import React, { useEffect, useState } from 'react';
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
import ChartPanel from './components/ChartPanel';
import MetricCard from './components/MetricCard';
import ConditionChart from './components/ConditionChart';
import ComplianceChart from './components/ComplianceChart';
import StudentHealthTable from './components/StudentHealthTable';
<<<<<<< HEAD
import { Heart, Syringe, AlertTriangle, Activity, Plus, ChevronDown } from 'lucide-react';
=======
import { Heart, Syringe, AlertTriangle, Activity, Loader2 } from 'lucide-react';
import { getHealthAndMedicalData, type HealthMetrics } from './api';
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d

// Define the interface for our health data rows
export interface FlaggedStudent {
  initials: string;
  name: string;
  grade: string;
  section: string;
  bloodGroup: string;
  condition: string;
  allergies: string;
  vaccination: 'Up to date' | 'Overdue';
  infirmaryVisits: number;
}

export default function HealthAndMedicalPage() {
<<<<<<< HEAD
  // Mock data extracted directly from the design system specifications
  const [students] = useState<FlaggedStudent[]>( [
    { initials: 'AS', name: 'Aarav Sharma', grade: '6', section: 'A', bloodGroup: 'O+', condition: '—', allergies: 'None', vaccination: 'Overdue', infirmaryVisits: 0 },
    { initials: 'PM', name: 'Pari Menon', grade: '10', section: 'A', bloodGroup: 'O-', condition: 'Asthma', allergies: 'Pollen, dust', vaccination: 'Up to date', infirmaryVisits: 4 },
    { initials: 'NK', name: 'Neil Kulkarni', grade: '7', section: 'B', bloodGroup: 'B-', condition: 'Peanut allergy', allergies: 'Peanuts, tree nuts', vaccination: 'Up to date', infirmaryVisits: 1 },
    { initials: 'VM', name: 'Vihaan Mehta', grade: '10', section: 'B', bloodGroup: 'B+', condition: 'Type 1 diabetes', allergies: 'None', vaccination: 'Overdue', infirmaryVisits: 4 },
    { initials: 'SP', name: 'Saanvi Pillai', grade: '7', section: 'A', bloodGroup: 'O-', condition: 'Lactose intolerance', allergies: 'Dairy', vaccination: 'Up to date', infirmaryVisits: 1 },
    { initials: 'RN', name: 'Rohan Nair', grade: '10', section: 'A', bloodGroup: 'O+', condition: 'Epilepsy', allergies: 'None', vaccination: 'Up to date', infirmaryVisits: 4 },
    { initials: 'RS', name: 'Riya Singh', grade: '7', section: 'B', bloodGroup: 'B+', condition: 'Dust allergy', allergies: 'House dust mites', vaccination: 'Up to date', infirmaryVisits: 1 },
    { initials: 'RJ', name: 'Reyansh Joshi', grade: '9', section: 'B', bloodGroup: 'O-', condition: '—', allergies: 'None', vaccination: 'Overdue', infirmaryVisits: 3 },
  ]);

  return (
   
      <div className="mx-auto shadow-sm p-6">

        {/* Top Analytics KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <MetricCard title="Health profiles" value="100" icon={<Heart className="text-indigo-500" size={18} />} />
          <MetricCard 
            title="Vaccination compliance" 
            value="88%" 
            icon={<Syringe className="text-indigo-500" size={18} />} 
            badge={{ text: "+3% this term", trend: "up" }} 
          />
          <MetricCard title="Allergies flagged" value="20" icon={<AlertTriangle className="text-indigo-500" size={18} />} />
          <MetricCard title="Infirmary visits (term)" value="200" icon={<Activity className="text-indigo-500" size={18} />} />
        </div>

        {/* Charts Presentation Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <ChartPanel title="Vaccination compliance" subtitle="Immunisation status across the cohort">
            <ComplianceChart compliancePercentage={88} />
          </ChartPanel>
          <ChartPanel title="Recorded conditions" subtitle="Students flagged by medical condition type">
            <ConditionChart />
          </ChartPanel>
        </div>

        {/* Flagged Records Live DataTable */}
        <StudentHealthTable students={students} />
      </div>
  );
}
=======
  const [students, setStudents] = useState<FlaggedStudent[]>([]);
  const [metrics, setMetrics] = useState<HealthMetrics>({
    totalProfiles: 0,
    vaccinationCompliance: 0,
    conditionsFlagged: 0,
    infirmaryVisits: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    getHealthAndMedicalData(controller.signal)
      .then((result) => {
        setStudents(result.flagged);
        setMetrics(result.metrics);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(reason instanceof Error ? reason.message : 'Unable to load health and medical records.');
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
        Loading health and medical records…
      </div>
    );
  }

  return (

    <div className="mx-auto shadow-sm p-6">

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Top Analytics KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard title="Health profiles" value={String(metrics.totalProfiles)} icon={<Heart className="text-indigo-500" size={18} />} />
        <MetricCard
          title="Vaccination compliance"
          value={`${metrics.vaccinationCompliance}%`}
          icon={<Syringe className="text-indigo-500" size={18} />}
        />
        <MetricCard title="Conditions flagged" value={String(metrics.conditionsFlagged)} icon={<AlertTriangle className="text-indigo-500" size={18} />} />
        <MetricCard title="Infirmary visits (term)" value={String(metrics.infirmaryVisits)} icon={<Activity className="text-indigo-500" size={18} />} />
      </div>

      {/* Charts Presentation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <ChartPanel title="Vaccination compliance" subtitle="Immunisation status across the cohort">
          <ComplianceChart compliancePercentage={metrics.vaccinationCompliance} />
        </ChartPanel>
        <ChartPanel title="Recorded conditions" subtitle="Students flagged by medical condition type">
          <ConditionChart />
        </ChartPanel>
      </div>

      {/* Flagged Records Live DataTable */}
      <StudentHealthTable students={students} />
    </div>
  );
}
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
