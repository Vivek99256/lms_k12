"use client";

import React from 'react';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions
} from 'chart.js';
import { Radar } from 'react-chartjs-2';
import { Settings, Users } from 'lucide-react';

// Register Chart.js modules
ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

// Types & Interfaces
interface HouseMember {
  id: string;
  initials: string;
  name?: string;
}

interface HouseData {
  id: string;
  name: string;
  points: number;
  captain: {
    name: string;
    initials: string;
  };
  memberCount: number;
  members: HouseMember[];
  color: string;
  borderColor: string;
}

interface HousesContentProps {
  houses?: HouseData[];
  onMasterSetupClick?: () => void;
}

// Default/Mock Data based on the UI
const DEFAULT_HOUSES: HouseData[] = [
  {
    id: 'aravali',
    name: 'Aravali',
    points: 820,
    captain: { name: 'Aarav Sharma', initials: 'AS' },
    memberCount: 25,
    color: 'rgba(239, 68, 68, 0.2)', // red-500
    borderColor: 'rgb(239, 68, 68)',
    members: [
      { id: '1', initials: 'AS' },
      { id: '2', initials: 'PM' },
      { id: '3', initials: 'IR' },
      { id: '4', initials: 'TB' },
      { id: '5', initials: 'RS' },
      { id: '6', initials: 'NS' },
      { id: '7', initials: 'MM' },
    ]
  },
  {
    id: 'nilgiri',
    name: 'Nilgiri',
    points: 760,
    captain: { name: 'Ishaan Iyer', initials: 'II' },
    memberCount: 25,
    color: 'rgba(59, 130, 246, 0.2)', // blue-500
    borderColor: 'rgb(59, 130, 246)',
    members: [
      { id: '1', initials: 'II' },
      { id: '2', initials: 'SM' },
      { id: '3', initials: 'VM' },
      { id: '4', initials: 'VC' },
      { id: '5', initials: 'ND' },
      { id: '6', initials: 'ZI' },
      { id: '7', initials: 'SM' },
    ]
  },
  {
    id: 'shivalik',
    name: 'Shivalik',
    points: 910,
    captain: { name: 'Ananya Gupta', initials: 'AG' },
    memberCount: 25,
    color: 'rgba(16, 185, 129, 0.2)', // emerald-500
    borderColor: 'rgb(16, 185, 129)',
    members: [
      { id: '1', initials: 'AG' },
      { id: '2', initials: 'NK' },
      { id: '3', initials: 'DB' },
      { id: '4', initials: 'RN' },
      { id: '5', initials: 'RJ' },
      { id: '6', initials: 'AG' },
      { id: '7', initials: 'AK' },
    ]
  },
  {
    id: 'vindhya',
    name: 'Vindhya',
    points: 680,
    captain: { name: 'Kiara Kapoor', initials: 'KK' },
    memberCount: 25,
    color: 'rgba(245, 158, 11, 0.2)', // amber-500
    borderColor: 'rgb(245, 158, 11)',
    members: [
      { id: '1', initials: 'KK' },
      { id: '2', initials: 'AV' },
      { id: '3', initials: 'SP' },
      { id: '4', initials: 'DR' },
      { id: '5', initials: 'KS' },
      { id: '6', initials: 'AK' },
      { id: '7', initials: 'KV' },
    ]
  }
];

export const HousesContent: React.FC<HousesContentProps> = ({
  houses = DEFAULT_HOUSES,
  onMasterSetupClick
}) => {
  
  // Chart Configuration
  const chartData: ChartData<'radar'> = {
    labels: ['Sports', 'Academics', 'Cultural', 'Discipline', 'Attendance'],
    datasets: houses.map(house => ({
      label: house.name,
      // Mock performance breakdowns across categories matching total standings visual positions
      data: house.id === 'shivalik' ? [85, 90, 78, 88, 92] :
            house.id === 'aravali'  ? [90, 80, 85, 75, 82] :
            house.id === 'nilgiri'  ? [75, 85, 70, 80, 78] : 
                                      [68, 72, 80, 65, 70],
      backgroundColor: house.color,
      borderColor: house.borderColor,
      borderWidth: 2,
      pointBackgroundColor: house.borderColor,
      pointBorderColor: '#fff',
      pointHoverBackgroundColor: '#fff',
      pointHoverBorderColor: house.borderColor,
    }))
  };

  const chartOptions: ChartOptions<'radar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          boxWidth: 10,
          padding: 20,
          font: { size: 12, family: 'Inter, sans-serif' }
        }
      },
      tooltip: {
        padding: 12,
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
      }
    },
    scales: {
      r: {
        angleLines: { color: '#e2e8f0' },
        grid: { color: '#e2e8f0' },
        pointLabels: {
          font: { size: 13, weight: 500, family: 'Inter, sans-serif' },
          color: '#475569'
        },
        ticks: { display: false },
        suggestedMin: 50,
        suggestedMax: 100
      }
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header Info Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Houses & groups</h2>
          <p className="text-slate-500 mt-1">
            Inter-house standings for co-curricular activities. Students are allocated to one of four houses.
          </p>
        </div>
        <button
          onClick={onMasterSetupClick}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-colors shadow-sm self-start sm:self-center"
        >
          <Settings className="w-4 h-4 text-slate-500" />
          <span>House master setup</span>
        </button>
      </div>

      {/* Radar Chart Card */}
      <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
        <div className="mb-4">
          <h3 className="font-semibold text-slate-800 text-lg">Inter-house standings</h3>
          <p className="text-xs text-slate-400 mt-0.5">Points earned across five activity categories, by house</p>
        </div>
        <div className="h-[380px] w-full flex items-center justify-center">
          <Radar data={chartData} options={chartOptions} />
        </div>
      </div>

      {/* Standings Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {houses.map((house) => (
          <div key={house.id} className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm flex flex-col justify-between relative overflow-hidden">
            {/* Top Row */}
            <div className="flex justify-between items-start">
              <div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-50 text-slate-600 border border-slate-100">
                  {house.name}
                </span>
                <div className="text-2xl font-bold text-slate-800 mt-2">
                  {house.points} <span className="text-xs font-normal text-slate-400">pts</span>
                </div>
              </div>
              <span className="text-xs font-semibold px-2 py-1 rounded bg-slate-50 border border-slate-100 text-slate-500">
                {house.memberCount}
              </span>
            </div>

            {/* Captain Breakdown */}
            <div className="my-5 pt-4 border-t border-slate-50">
              <div className="text-xs text-slate-400 mb-2">House captain</div>
              <div className="flex items-center gap-3">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm"
                  style={{ backgroundColor: house.borderColor }}
                >
                  {house.captain.initials}
                </div>
                <span className="text-sm font-medium text-slate-700">{house.captain.name}</span>
              </div>
            </div>

            {/* Avatars Pile & Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-50 mt-auto">
              <div className="flex -space-x-2 overflow-hidden">
                {house.members.map((member) => (
                  <div
                    key={member.id}
                    className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-slate-100 flex items-center justify-center text-[9px] font-semibold text-slate-500"
                  >
                    {member.initials}
                  </div>
                ))}
              </div>
              <span className="text-xs text-slate-400 inline-flex items-center gap-1">
                <Users className="w-3 h-3" />
                {house.memberCount} members
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HousesContent;