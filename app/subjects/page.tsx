'use client';

import React, { useState } from 'react';
import { Search, BookOpen, TrendingUp, Award, Clock } from 'lucide-react';
import Link from 'next/link';

const subjects = [
  { name: "Mathematics", chapters: 12, progress: 80, emoji: "📐", color: "#6366F1" },
  { name: "Science", chapters: 15, progress: 65, emoji: "🔬", color: "#10B981" },
  { name: "English", chapters: 10, progress: 90, emoji: "📖", color: "#8B5CF6" },
  { name: "Social Science", chapters: 8, progress: 45, emoji: "🌍", color: "#F59E0B" },
  { name: "Computer", chapters: 5, progress: 75, emoji: "💻", color: "#06B6D4" },
  { name: "Gujarati", chapters: 6, progress: 55, emoji: "✍️", color: "#EC4899" },
  { name: "Hindi", chapters: 8, progress: 30, emoji: "🗣️", color: "#EF4444" },
  { name: "Sanskrit", chapters: 4, progress: 20, emoji: "📜", color: "#D97706" },
  { name: "Physical Ed", chapters: 2, progress: 100, emoji: "⚽", color: "#84CC16" },
  { name: "Art & Craft", chapters: 3, progress: 60, emoji: "🎨", color: "#6366F1" },
  { name: "Music", chapters: 5, progress: 40, emoji: "🎵", color: "#F43F5E" },
  { name: "Gen Knowledge", chapters: 10, progress: 85, emoji: "🧠", color: "#14B8A6" },
  { name: "Accountancy", chapters: 8, progress: 10, emoji: "📊", color: "#3B82F6" },
  { name: "Business", chapters: 5, progress: 5, emoji: "💼", color: "#10B981" },
  { name: "Economics", chapters: 9, progress: 50, emoji: "📈", color: "#7C3AED" },
  { name: "Statistics", chapters: 11, progress: 70, emoji: "📉", color: "#EA580C" },
  { name: "Geography", chapters: 14, progress: 35, emoji: "🗺️", color: "#0891B2" },
  { name: "History", chapters: 12, progress: 60, emoji: "🏛️", color: "#DB2777" },
  { name: "Biology", chapters: 9, progress: 80, emoji: "🧬", color: "#16A34A" },
  { name: "Chemistry", chapters: 11, progress: 45, emoji: "⚗️", color: "#9333EA" },
  { name: "Physics", chapters: 13, progress: 55, emoji: "⚡", color: "#CA8A04" },
];

export default function SubjectsPage() {
  const [search, setSearch] = useState('');
  const filtered = subjects.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  const topSubject = [...subjects].sort((a, b) => b.progress - a.progress)[0];
  const avgProgress = Math.round(subjects.reduce((acc, s) => acc + s.progress, 0) / subjects.length);
  const completed = subjects.filter(s => s.progress === 100).length;

  return (
    <div className="flex-1 overflow-auto px-6 py-6">

      {/* Top header bar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Subjects</h1>
          <p className="text-sm text-gray-500 mt-0.5">{subjects.length} subjects · Class 10</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400 shadow-sm w-52 transition-all"
          />
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center"><TrendingUp size={18} className="text-indigo-600" /></div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Avg Progress</div>
            <div className="text-xl font-bold text-gray-900">{avgProgress}%</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center"><Award size={18} className="text-emerald-600" /></div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Completed</div>
            <div className="text-xl font-bold text-gray-900">{completed} <span className="text-sm text-gray-400">subjects</span></div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center"><Clock size={18} className="text-amber-600" /></div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Top Subject</div>
            <div className="text-sm font-bold text-gray-900 truncate">{topSubject.name}</div>
          </div>
        </div>
      </div>

      {/* Subject Tiles Grid */}
      <div
        className="grid gap-2.5"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}
      >
        {filtered.map((sub, i) => (
              <Link
                href="/chapters"
                key={i}
                className="group bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col gap-2 cursor-pointer relative overflow-hidden"
              >
            {/* Subtle colored glow blob on hover */}
            <div
              className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none"
              style={{ backgroundColor: sub.color }}
            />

            {/* Top row: emoji icon + progress % */}
            <div className="flex items-start justify-between">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow-sm"
                style={{ backgroundColor: sub.color + '20' }}
              >
                {sub.emoji}
              </div>
              <span className="text-xs font-bold" style={{ color: sub.color }}>
                {sub.progress}%
              </span>
            </div>

            {/* Subject Name */}
            <div className="font-semibold text-gray-800 text-sm leading-snug group-hover:text-gray-900 transition-colors">
              {sub.name}
            </div>

            {/* Chapters */}
            <div className="flex items-center gap-1 text-[11px] text-gray-400">
              <BookOpen size={10} />
              {sub.chapters} chapters
            </div>

            {/* Thin progress bar */}
            <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${sub.progress}%`, backgroundColor: sub.color }}
              />
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400 text-sm">No subjects match your search.</div>
      )}

    </div>
  );
}
