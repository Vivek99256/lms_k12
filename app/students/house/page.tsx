"use client";

import React, { useEffect, useState } from "react";
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
import { Settings, Users, Loader2 } from 'lucide-react';
import { getHouses, type HouseData } from './api';

// Register Chart.js modules
ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

interface HousesContentProps {
  onMasterSetupClick?: () => void;
}

export const HousesContent: React.FC<HousesContentProps> = ({
  onMasterSetupClick
}) => {
  const [houses, setHouses] = useState<HouseData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    getHouses(controller.signal)
      .then(setHouses)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(reason instanceof Error ? reason.message : 'Unable to load houses.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, []);

  // Chart Configuration
  const chartData: ChartData<'radar'> = {
    labels: ['Sports', 'Academics', 'Cultural', 'Discipline', 'Attendance'],
    datasets: houses.map(house => {
      const score = Math.min(100, house.memberCount * 4);
      return {
        label: house.name,
        data: [score, score, score, score, score],
        backgroundColor: house.color,
        borderColor: house.borderColor,
        borderWidth: 2,
        pointBackgroundColor: house.borderColor,
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: house.borderColor,
      };
    })
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
        suggestedMin: 0,
        suggestedMax: 100
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading houses…
      </div>
    );
  }

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

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

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
                {house.members.slice(0, 8).map((member) => (
                  <div
                    key={member.id}
                    className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-slate-100 flex items-center justify-center text-[9px] font-semibold text-slate-500"
                  >
                    {member.initials}
                  </div>
                ))}
                {house.members.length > 8 && (
                  <div className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-slate-200 flex items-center justify-center text-[8px] font-semibold text-slate-600">
                    +{house.members.length - 8}
                  </div>
                )}
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
