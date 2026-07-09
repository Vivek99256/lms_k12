"use client";

// page.tsx
import React, { useState } from 'react';
import DisciplineChart from './components/DisciplineChart';
import IncidentsTable from './components/IncidentsTable';
import MetricCard from './components/MetricCard';
import { Plus, ChevronDown, ShieldAlert, Ban, UserCheck, CheckCircle } from 'lucide-react';

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
  // Mock data matching the UI specifications
  const [incidents] = useState<Incident[]>([
    { date: '28 Jun', initials: 'IR', name: 'Ira Reddy', grade: '9', section: 'B', category: 'Late to class', demeritPoints: -2, status: 'Resolved' },
    { date: '26 Jun', initials: 'KS', name: 'Kian Shetty', grade: '10', section: 'B', category: 'Uniform violation', demeritPoints: -1, status: 'Open' },
    { date: '24 Jun', initials: 'KC', name: 'Kiara Chopra', grade: '9', section: 'A', category: 'Disruptive behaviour', demeritPoints: -5, status: 'Under review' },
    { date: '21 Jun', initials: 'SI', name: 'Saanvi Iyer', grade: '7', section: 'A', category: 'Missing homework', demeritPoints: -2, status: 'Resolved' },
    { date: '18 Jun', initials: 'AB', name: 'Arjun Bhat', grade: '8', section: 'A', category: 'Damage to property', demeritPoints: -8, status: 'Under review' },
  ]);

  return (
    <div className="min-h-screen p-4 md:p-8 font-sans antialiased text-slate-600">
     
        {/* Analytics Top Cards Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <MetricCard title="Incidents this term" value="5" icon={<ShieldAlert className="text-indigo-500" size={18} />} badge={{ text: "-2 vs last term", positive: true }} />
          <MetricCard title="Demerit points issued" value="18" icon={<Ban className="text-indigo-500" size={18} />} />
          <MetricCard title="Students flagged" value="5" icon={<UserCheck className="text-indigo-500" size={18} />} />
          <MetricCard title="Resolved" value="2" icon={<CheckCircle className="text-indigo-500" size={18} />} />
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