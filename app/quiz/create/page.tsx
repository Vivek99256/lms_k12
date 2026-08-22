'use client';

import React, { useEffect, useState } from 'react';
import { BookOpen, Plus, Trash2, CheckCircle2, Settings, Layers, Save, AlertCircle, PlayCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { buildSessionContext, fetchQuizSubjects, type QuizChapter, type QuizSubject } from '../_lib/quiz-api';

export default function CreateQuizPage() {
  const router = useRouter();
  const [isPublishing, setIsPublishing] = useState(false);
  const [subjectsData, setSubjectsData] = useState<QuizSubject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<QuizSubject | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<QuizChapter | null>(null);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSubjects() {
      try {
        const session = buildSessionContext();
        const subjects = await fetchQuizSubjects(session);
        if (cancelled) return;
        setSubjectsData(subjects);
        setSelectedSubject(subjects[0] ?? null);
        setSelectedChapter(subjects[0]?.chapters[0] ?? null);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load subjects.');
      } finally {
        if (!cancelled) setLoadingSubjects(false);
      }
    }

    loadSubjects();
    return () => {
      cancelled = true;
    };
  }, []);

  const [quizDetails, setQuizDetails] = useState({
    title: '',
    timeLimit: 30,
    passingScore: 60,
  });

  useEffect(() => {
    if (selectedChapter && !quizDetails.title) {
      setQuizDetails((prev) => ({ ...prev, title: `${selectedChapter.name}: Assessment` }));
    }
  }, [selectedChapter, quizDetails.title]);

  const [questions, setQuestions] = useState<{ id: number; text: string; options: string[]; correctOptionIndex: number }[]>([
    {
      id: 1,
      text: '',
      options: ['', '', '', ''],
      correctOptionIndex: 0,
    }
  ]);

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        id: Date.now(),
        text: '',
        options: ['', '', '', ''],
        correctOptionIndex: 0,
      }
    ]);
  };

  const updateQuestion = (index: number, field: string, value: string | number) => {
    const updated = [...questions];
    (updated[index] as unknown as Record<string, string | number>)[field] = value;
    setQuestions(updated);
  };

  const updateOption = (qIndex: number, oIndex: number, value: string) => {
    const updated = [...questions];
    updated[qIndex].options[oIndex] = value;
    setQuestions(updated);
  };

  const deleteQuestion = (index: number) => {
    if (questions.length === 1) return; // Keep at least one
    const updated = [...questions];
    updated.splice(index, 1);
    setQuestions(updated);
  };

  const handlePublish = () => {
    setIsPublishing(true);
    setTimeout(() => {
      setIsPublishing(false);
      router.push('/quiz');
    }, 1500);
  };

  return (
    <div className="flex-1 overflow-y-auto">
          {/* Top Bar */}
          <div className="bg-white border-b border-gray-100 sticky top-0 z-10 px-8 py-5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <Link href="/quiz" className="hover:text-[#0D6EFD] transition-colors">Quizzes</Link>
                <span>/</span>
                <span className="text-gray-900 font-medium">Create Quiz</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Quiz Builder</h1>
            </div>
            <div className="flex items-center gap-4">
              <button className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors flex items-center gap-2">
                <PlayCircle size={18} /> Preview
              </button>
              <button 
                onClick={handlePublish}
                disabled={isPublishing}
                className={`px-6 py-2.5 rounded-xl text-white font-semibold text-sm shadow-md transition-all flex items-center gap-2 ${isPublishing ? 'bg-blue-400 cursor-not-allowed' : 'bg-[#0D6EFD] shadow-blue-500/30 hover:bg-blue-700 hover:-translate-y-0.5'}`}
              >
                {isPublishing ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} 
                {isPublishing ? 'Publishing...' : 'Publish Quiz'}
              </button>
            </div>
          </div>

          <div className="p-8 max-w-5xl mx-auto space-y-8 pb-24">
            
            {/* Section 1: Target Subject & Chapter */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-100">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-[#0D6EFD]">
                  <BookOpen size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">1. Target Audience</h2>
                  <p className="text-sm text-gray-500">Select the subject and chapter this quiz belongs to.</p>
                </div>
              </div>

              {loadingSubjects ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
                  <Loader2 size={16} className="animate-spin" /> Loading subjects...
                </div>
              ) : loadError ? (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-4">
                  <AlertCircle size={16} /> {loadError}
                </div>
              ) : subjectsData.length === 0 ? (
                <p className="text-sm text-gray-500">No subjects found for this account.</p>
              ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Subject</label>
                  <select
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-2xl focus:ring-blue-500 focus:border-blue-500 block p-4 outline-none transition-all"
                    value={selectedSubject?.id ?? ''}
                    onChange={(e) => {
                      const sub = subjectsData.find(s => s.id === parseInt(e.target.value));
                      if (sub) {
                        setSelectedSubject(sub);
                        setSelectedChapter(sub.chapters[0] ?? null);
                      }
                    }}
                  >
                    {subjectsData.map(sub => (
                      <option key={sub.id} value={sub.id}>{sub.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Chapter</label>
                  <select
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-2xl focus:ring-blue-500 focus:border-blue-500 block p-4 outline-none transition-all"
                    value={selectedChapter?.id ?? ''}
                    onChange={(e) => {
                      const ch = selectedSubject?.chapters.find(c => c.id === parseInt(e.target.value));
                      if (ch) setSelectedChapter(ch);
                    }}
                  >
                    {(selectedSubject?.chapters ?? []).map(ch => (
                      <option key={ch.id} value={ch.id}>{ch.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              )}
            </div>

            {/* Section 2: Quiz Settings */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-100">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                  <Settings size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">2. Quiz Details</h2>
                  <p className="text-sm text-gray-500">Configure the basic settings for this quiz.</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Quiz Title</label>
                  <input 
                    type="text" 
                    value={quizDetails.title}
                    onChange={(e) => setQuizDetails({...quizDetails, title: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-2xl focus:ring-purple-500 focus:border-purple-500 block p-4 outline-none transition-all"
                    placeholder="E.g., Mid-Term Assessment"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Time Limit (Minutes)</label>
                    <input 
                      type="number" 
                      value={quizDetails.timeLimit}
                      onChange={(e) => setQuizDetails({...quizDetails, timeLimit: parseInt(e.target.value)})}
                      className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-2xl focus:ring-purple-500 focus:border-purple-500 block p-4 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Passing Score (%)</label>
                    <input 
                      type="number" 
                      value={quizDetails.passingScore}
                      onChange={(e) => setQuizDetails({...quizDetails, passingScore: parseInt(e.target.value)})}
                      className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-2xl focus:ring-purple-500 focus:border-purple-500 block p-4 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Questions */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <Layers size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">3. Questions</h2>
                    <p className="text-sm text-gray-500">Add multiple choice questions for the quiz.</p>
                  </div>
                </div>
                <div className="bg-emerald-50 text-emerald-700 px-4 py-1.5 rounded-full text-sm font-bold border border-emerald-100">
                  Total: {questions.length} Questions
                </div>
              </div>

              <div className="space-y-6">
                {questions.map((q, qIndex) => (
                  <div key={q.id} className="p-6 rounded-2xl border border-gray-200 bg-gray-50/50 relative group transition-all hover:border-gray-300">
                    
                    {/* Delete Question Button */}
                    {questions.length > 1 && (
                      <button 
                        onClick={() => deleteQuestion(qIndex)}
                        className="absolute -right-3 -top-3 w-8 h-8 bg-white border border-gray-200 rounded-full text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-all z-10"
                        title="Remove Question"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}

                    <div className="flex gap-4">
                      <div className="shrink-0 w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 font-bold text-sm shadow-sm">
                        {qIndex + 1}
                      </div>
                      <div className="flex-1 space-y-5">
                        {/* Question Text */}
                        <div>
                          <textarea 
                            value={q.text}
                            onChange={(e) => updateQuestion(qIndex, 'text', e.target.value)}
                            placeholder="Enter your question here..."
                            className="w-full bg-white border border-gray-200 text-gray-900 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 block p-4 outline-none transition-all resize-none font-medium"
                            rows={2}
                          />
                        </div>

                        {/* Options */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {q.options.map((opt, oIndex) => (
                            <div 
                              key={oIndex} 
                              className={`flex items-center gap-3 p-2 pr-4 rounded-xl border-2 transition-all ${q.correctOptionIndex === oIndex ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-transparent'}`}
                            >
                              <button 
                                onClick={() => updateQuestion(qIndex, 'correctOptionIndex', oIndex)}
                                className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors ${q.correctOptionIndex === oIndex ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 text-transparent hover:border-emerald-400'}`}
                                title="Mark as correct answer"
                              >
                                <CheckCircle2 size={14} strokeWidth={3} />
                              </button>
                              <input 
                                type="text"
                                value={opt}
                                onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                                placeholder={`Option ${oIndex + 1}`}
                                className="flex-1 bg-transparent border-b border-transparent focus:border-emerald-500 outline-none text-sm text-gray-700 py-1 transition-colors"
                              />
                            </div>
                          ))}
                        </div>
                        
                        <div className="flex items-center text-xs text-gray-500 mt-2 gap-1.5 bg-blue-50/50 p-2 rounded-lg border border-blue-100 inline-flex">
                          <AlertCircle size={14} className="text-blue-500" />
                          <span>Select the checkmark to mark the correct answer.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Add Question Button */}
                <button 
                  onClick={addQuestion}
                  className="w-full py-5 border-2 border-dashed border-gray-200 rounded-2xl text-gray-500 font-semibold hover:border-[#0D6EFD] hover:text-[#0D6EFD] hover:bg-blue-50/50 transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={20} /> Add New Question
                </button>
              </div>
            </div>

          </div>
        </div>
  );
}
