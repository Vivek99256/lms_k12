'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, FolderOpen, ChevronRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { fetchSubjects, subjectChapterCount, type LmsSubject } from '../_lib/subjects-api';

const PALETTE = ['#6366F1', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#0891B2', '#EC4899', '#14B8A6'];
const EMOJI = ['🎨', '🔬', '📐', '📖', '🏛️', '🗺️', '💻', '📊'];

type CategoryTile = {
  name: string;
  count: number;
  emoji: string;
  color: string;
};

function groupByCategory(subjects: LmsSubject[]): CategoryTile[] {
  const counts = new Map<string, number>();
  for (const subject of subjects) {
    const name = subject.content_category || subject.category_name || 'Uncategorized';
    counts.set(name, (counts.get(name) ?? 0) + subjectChapterCount(subject));
  }
  return Array.from(counts.entries()).map(([name, count], index) => ({
    name,
    count,
    emoji: EMOJI[index % EMOJI.length],
    color: PALETTE[index % PALETTE.length],
  }));
}

export default function SubjectCategoriesPage() {
  const [rawSubjects, setRawSubjects] = useState<LmsSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError('');
      try {
        const rows = await fetchSubjects();
        if (!cancelled) setRawSubjects(rows);
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : 'Unable to load subject categories.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => groupByCategory(rawSubjects), [rawSubjects]);

  return (
    <div className="flex-1 overflow-auto p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-semibold tracking-tight text-black">Subject Categories</h1>
        <p className="text-gray-600 mt-1 text-lg">Manage and organize your subject categories</p>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading categories…
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      {!loading && !error && categories.length === 0 && (
        <div className="text-center py-16 text-gray-400 text-sm">No subject categories available yet.</div>
      )}

      {!loading && !error && categories.length > 0 && (
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
      )}
    </div>
  );
}
