'use client';

import React from 'react';
import { BookOpen, FolderOpen, ChevronRight } from 'lucide-react';
import Link from 'next/link';

const categories = [
  { name: 'Arts', count: 24, emoji: '🎨', color: '#6366F1' },
  { name: 'Science', count: 32, emoji: '🔬', color: '#10B981' },
  { name: 'Mathematics', count: 28, emoji: '📐', color: '#F59E0B' },
  { name: 'English', count: 18, emoji: '📖', color: '#8B5CF6' },
  { name: 'History', count: 16, emoji: '🏛️', color: '#EF4444' },
  { name: 'Geography', count: 20, emoji: '🗺️', color: '#0891B2' },
];

export default function SubjectCategoriesPage() {
  return (
    <div className="flex-1 overflow-auto p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-semibold tracking-tight text-black">Subject Categories</h1>
        <p className="text-gray-600 mt-1 text-lg">Manage and organize your subject categories</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((cat, idx) => (
          <Link
            key={idx}
            href={`/subjects/categories/${cat.name.toLowerCase()}`}
            className="card bg-white p-6 hover:shadow-lg transition-all duration-200 group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm"
                style={{ backgroundColor: cat.color + '20' }}
              >
                {cat.emoji}
              </div>
              <ChevronRight size={20} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
            </div>
            <h3 className="font-bold text-lg text-gray-900 mb-1">{cat.name}</h3>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <FolderOpen size={14} />
              <span>{cat.count} chapters</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
