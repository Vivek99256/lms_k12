'use client';

import { Suspense, useEffect, useState } from 'react';
import { FileText, Download, Play, CheckCircle2, Clock, BookOpen, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { ChapterContentAsset } from '@/app/course-master/data/chapters';
import { fetchChapters, fetchChapterPdfAsset, chapterLessons, chapterContentText, type Chapter } from './_lib/chapters-api';

function ChapterViewContent() {
  const searchParams = useSearchParams();
  const subjectId = searchParams.get('subjectId') ?? '';
  const standardId = searchParams.get('standardId') ?? '';

  const [activeTab, setActiveTab] = useState<'Overview' | 'Content' | 'Resources' | 'Quiz'>('Overview');
  const [notes, setNotes] = useState('');
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [subjectName, setSubjectName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [pdfAsset, setPdfAsset] = useState<ChapterContentAsset | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!subjectId) {
        setLoading(false);
        setError('No subject selected. Go back to Subjects and pick a subject.');
        return;
      }

      setLoading(true);
      setError('');
      try {
        const { subject, chapters: fetchedChapters } = await fetchChapters(subjectId, standardId || undefined);
        if (cancelled) return;
        setChapters(fetchedChapters);
        setSubjectName(subject?.subject_name || '');
        setActiveChapterIndex(0);
        if (fetchedChapters.length === 0) {
          setError('No chapters are available for this subject yet.');
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : 'Unable to load chapters.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [subjectId, standardId]);

  const activeChapter = chapters[activeChapterIndex];

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!activeChapter) {
        setPdfAsset(null);
        return;
      }
      setPdfLoading(true);
      try {
        const asset = await fetchChapterPdfAsset(Number(activeChapter.id));
        if (!cancelled) setPdfAsset(asset);
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeChapter]);

  if (loading) {
    return (
      <div className="flex-1 overflow-auto p-8">
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading chapters…
        </div>
      </div>
    );
  }

  if (error && chapters.length === 0) {
    return (
      <div className="flex-1 overflow-auto p-8">
        <Link
          href="/subjects"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-blue-600 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-200 px-4 py-2 rounded-xl transition-all mb-5 shadow-sm group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Back to Subjects
        </Link>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>
      </div>
    );
  }

  if (!activeChapter) return null;

  const lessons = chapterLessons(activeChapter);
  const chapterProgress = 0; // The chapters API does not return a per-chapter completion percentage yet.

  return (
    <div className="flex-1 overflow-auto p-8">
          {/* Back Button */}
          <Link
            href="/subjects"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-blue-600 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-200 px-4 py-2 rounded-xl transition-all mb-5 shadow-sm group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Back to Subjects
          </Link>

          {/* Breadcrumb */}
          <div className="text-sm text-gray-500 mb-1">{subjectName || 'Subject'} • Chapter {activeChapterIndex + 1}</div>
          <h1 className="text-3xl font-semibold tracking-tight">Chapter {activeChapterIndex + 1}: {activeChapter.title}</h1>
          <p className="text-gray-600 mt-1 max-w-2xl">Learn about {activeChapter.title.toLowerCase()} and its key principles.</p>

          <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Panel - Chapter Navigation */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-[24px] p-6 border border-gray-100 shadow-sm">
                <h4 className="font-semibold text-gray-900 mb-5 flex items-center gap-2"><BookOpen size={18} className="text-blue-500" /> Chapters</h4>
                <div className="space-y-2 mb-8">
                  {chapters.map((ch, idx) => (
                    <div
                      key={ch.id}
                      onClick={() => setActiveChapterIndex(idx)}
                      className={`px-4 py-3.5 rounded-2xl text-sm flex justify-between items-center cursor-pointer transition-all duration-300 ${activeChapterIndex === idx ? 'bg-blue-600 text-white font-medium shadow-md shadow-blue-500/30 -translate-y-0.5' : 'bg-gray-50 hover:bg-gray-100 text-gray-700'}`}
                    >
                      <span className="truncate pr-2">{ch.title}</span>
                    </div>
                  ))}
                </div>

                <h4 className="font-semibold text-gray-900 mb-4 text-sm flex items-center gap-2"><Clock size={16} className="text-emerald-500" /> Lessons in this Chapter</h4>
                <ul className="space-y-3">
                  {lessons.length === 0 && (
                    <li className="text-sm text-gray-400">No lessons added yet.</li>
                  )}
                  {lessons.map((lesson, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-gray-600 group">
                      <div className="mt-0.5 w-5 h-5 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform"><CheckCircle2 size={12} /></div>
                      <span className="group-hover:text-gray-900 transition-colors">{lesson}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Center Content */}
            <div className="lg:col-span-6">
              <div className="bg-white rounded-[24px] p-8 border border-gray-100 shadow-sm min-h-full">
                {/* Tabs */}
                <div className="flex flex-row bg-gray-50/80 p-1.5 rounded-2xl mb-8 w-full border border-gray-100 gap-1">
                  {(['Overview', 'Content', 'Resources', 'Quiz'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 px-4 py-2.5 text-center text-sm font-semibold rounded-xl transition-all duration-300 ${activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'}`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {activeTab === 'Overview' && (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><FileText size={18} className="text-red-500" /> Study Material</h3>
                    {pdfLoading ? (
                      <div className="flex items-center gap-2 p-4 text-sm text-gray-400 mb-8">
                        <Loader2 className="h-4 w-4 animate-spin" /> Checking for uploaded material…
                      </div>
                    ) : pdfAsset ? (
                      <div className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl mb-8 shadow-sm hover:shadow-md hover:border-blue-100 transition-all gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-12 h-12 bg-red-50 text-red-500 rounded-xl flex items-center justify-center shrink-0">
                            <FileText size={24} />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">{pdfAsset.filename || pdfAsset.title}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{pdfAsset.file_type || 'Document'}</div>
                          </div>
                        </div>
                        <a
                          href={pdfAsset.url ?? '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold bg-gray-50 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors w-full sm:w-auto shrink-0"
                        >
                          <Download size={16} /> Download
                        </a>
                      </div>
                    ) : (
                      <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl mb-8 text-sm text-gray-500">
                        No study material has been uploaded for this chapter yet.
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'Content' && (
                  <div className="prose max-w-none text-gray-700">
                    <p>{chapterContentText(activeChapter)}</p>
                  </div>
                )}

                {activeTab === 'Resources' && <div>Additional videos and links will appear here.</div>}
                {activeTab === 'Quiz' && (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><FileText size={18} className="text-blue-500" /> Available Assessments</h3>

                    <div className="group flex flex-col md:flex-row md:items-center justify-between p-5 bg-white border border-gray-100 rounded-2xl mb-8 shadow-sm hover:shadow-md hover:border-blue-200 transition-all gap-5 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>

                      <div className="flex items-center gap-4 relative z-10 flex-1 min-w-0">
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-md shadow-blue-500/30">
                          <CheckCircle2 size={26} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-gray-900 text-lg group-hover:text-blue-600 transition-colors truncate">Chapter {activeChapterIndex + 1}: Assessment</div>
                        </div>
                      </div>

                      <div className="relative z-10 shrink-0 mt-2 md:mt-0">
                        <Link href="/quiz/take" className="flex items-center justify-center gap-2 px-8 py-3 text-sm font-bold bg-[#0D6EFD] text-white rounded-xl shadow-md shadow-blue-500/30 hover:-translate-y-0.5 hover:bg-blue-700 transition-all w-full md:w-auto">
                          Start Quiz <Play size={16} className="fill-white" />
                        </Link>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-10 flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-50">
                  <button className="flex-1 py-3 rounded-xl bg-white border border-gray-200 font-semibold text-gray-700 text-sm hover:bg-gray-50 hover:border-gray-300 transition-all">Mark Complete</button>
                  <Link href="/quiz/take" className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm shadow-md shadow-blue-500/30 hover:bg-blue-700 transition-all hover:-translate-y-0.5 text-center block">Take Quiz</Link>
                  <button className="flex-1 py-3 rounded-xl bg-white border border-gray-200 font-semibold text-gray-700 text-sm hover:bg-gray-50 hover:border-gray-300 transition-all">Download Notes</button>
                </div>
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="lg:col-span-3 space-y-6">
              <div className="bg-white rounded-[24px] p-6 border border-gray-100 shadow-sm text-center">
                <h4 className="font-semibold text-gray-900 mb-6">Chapter Progress</h4>
                <div className="relative w-32 h-32 mx-auto mb-4">
                  <svg className="w-32 h-32 -rotate-90 transition-all duration-1000" viewBox="0 0 36 36">
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#f3f4f6" strokeWidth="2.5" />
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeDasharray={`${chapterProgress}, 100`} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-gray-900">{chapterProgress}%</span>
                    <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mt-1">Completed</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[24px] p-6 border border-gray-100 shadow-sm">
                <h4 className="font-semibold text-gray-900 mb-4">Upcoming Tasks</h4>
                <div className="space-y-3 text-sm text-gray-400">No upcoming tasks for this chapter.</div>
              </div>

              <div className="bg-white rounded-[24px] p-6 border border-gray-100 shadow-sm">
                <h4 className="font-semibold text-gray-900 mb-3">Quick Notes</h4>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Jot down quick thoughts..."
                  className="w-full h-28 text-sm p-4 bg-gray-50 border border-gray-200 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
                />
                <button className="mt-3 w-full text-sm py-3 rounded-xl bg-gray-900 hover:bg-gray-800 transition-colors text-white font-semibold">Save Note</button>
              </div>
          </div>
        </div>
      </div>
  );
}

export default function ChapterView() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 overflow-auto p-8">
          <div className="flex items-center justify-center gap-2 py-24 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading chapters…
          </div>
        </div>
      }
    >
      <ChapterViewContent />
    </Suspense>
  );
}
