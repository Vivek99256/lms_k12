'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { ChevronLeft, BookOpen, Clock, Award } from 'lucide-react';
import Link from 'next/link';

const categoryDetails: Record<string, { emoji: string; color: string; chapters: { name: string; progress: number }[] }> = {
  arts: {
    emoji: '🎨',
    color: '#6366F1',
    chapters: [
      { name: 'Drawing Basics', progress: 80 },
      { name: 'Color Theory', progress: 60 },
      { name: 'Painting Techniques', progress: 45 },
      { name: 'Craft Work', progress: 90 },
      { name: 'Art History', progress: 30 },
    ],
  },
  science: {
    emoji: '🔬',
    color: '#10B981',
    chapters: [
      { name: 'Chemical Reactions', progress: 75 },
      { name: 'Physics Fundamentals', progress: 60 },
      { name: 'Biology Basics', progress: 85 },
      { name: 'Lab Experiments', progress: 40 },
      { name: 'Scientific Method', progress: 95 },
    ],
  },
  mathematics: {
    emoji: '📐',
    color: '#F59E0B',
    chapters: [
      { name: 'Algebra', progress: 70 },
      { name: 'Geometry', progress: 55 },
      { name: 'Trigonometry', progress: 40 },
      { name: 'Statistics', progress: 80 },
      { name: 'Calculus Basics', progress: 25 },
    ],
  },
  english: {
    emoji: '📖',
    color: '#8B5CF6',
    chapters: [
      { name: 'Grammar', progress: 90 },
      { name: 'Literature', progress: 65 },
      { name: 'Writing Skills', progress: 75 },
      { name: 'Comprehension', progress: 85 },
      { name: 'Vocabulary', progress: 60 },
    ],
  },
  history: {
    emoji: '🏛️',
    color: '#EF4444',
    chapters: [
      { name: 'Ancient Civilizations', progress: 70 },
      { name: 'Medieval Period', progress: 50 },
      { name: 'Modern History', progress: 80 },
      { name: 'World Wars', progress: 60 },
      { name: 'Indian Independence', progress: 90 },
    ],
  },
  geography: {
    emoji: '🗺️',
    color: '#0891B2',
    chapters: [
      { name: 'Physical Geography', progress: 65 },
      { name: 'Human Geography', progress: 55 },
      { name: 'Map Reading', progress: 80 },
      { name: 'Climate & Weather', progress: 70 },
      { name: 'Resources', progress: 45 },
    ],
  },
};

export default function CategoryDetailPage() {
  const params = useParams();
  const categoryKey = typeof params.category === 'string' ? params.category.toLowerCase() : '';
  const data = categoryDetails[categoryKey];

  if (!data) {
    return (
      <div className="flex-1 overflow-auto p-8">
        <div className="text-center py-16">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Category Not Found</h1>
          <p className="text-gray-500">The category you're looking for doesn't exist.</p>
          <Link href="/subjects/categories" className="mt-4 inline-flex items-center gap-2 text-[#0D6EFD] hover:underline">
            <ChevronLeft size={16} /> Back to Categories
          </Link>
        </div>
      </div>
    );
  }

  const avgProgress = Math.round(
    data.chapters.reduce((acc, ch) => acc + ch.progress, 0) / data.chapters.length
  );

  return (
    <div className="flex-1 overflow-auto p-8">
      <div className="mb-8">
        <Link href="/subjects/categories" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4 text-sm">
          <ChevronLeft size={16} /> Back to Categories
        </Link>
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-md"
            style={{ backgroundColor: data.color + '20' }}
          >
            {data.emoji}
          </div>
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-black capitalize">{categoryKey}</h1>
            <p className="text-gray-600 mt-1 text-lg">{data.chapters.length} chapters · Avg {avgProgress}% progress</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center"><BookOpen size={18} className="text-[#0D6EFD]" /></div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Total Chapters</div>
            <div className="text-xl font-bold text-gray-900">{data.chapters.length}</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center"><Award size={18} className="text-emerald-600" /></div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Avg Progress</div>
            <div className="text-xl font-bold text-gray-900">{avgProgress}%</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center"><Clock size={18} className="text-amber-600" /></div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Status</div>
            <div className="text-xl font-bold text-gray-900">Active</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-lg text-gray-900">Chapters in {categoryKey}</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {data.chapters.map((chapter, idx) => (
            <div key={idx} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: data.color }}>
                  {idx + 1}
                </div>
                <span className="text-sm font-medium text-gray-800">{chapter.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${chapter.progress}%`, backgroundColor: data.color }} />
                </div>
                <span className="text-xs font-bold text-gray-600 w-8 text-right">{chapter.progress}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
