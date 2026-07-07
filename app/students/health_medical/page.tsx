"use client";
// page.tsx
import React, { useState } from 'react';
import ChartPanel from './components/ChartPanel';
import MetricCard from './components/MetricCard';
import ConditionChart from './components/ConditionChart';
import ComplianceChart from './components/ComplianceChart';
import StudentHealthTable from './components/StudentHealthTable';
import { Heart, Syringe, AlertTriangle, Activity, Plus, ChevronDown } from 'lucide-react';

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
   
      <div className="max-w-7xl mx-auto shadow-sm p-6">

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