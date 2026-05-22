'use client';

import React, { useState } from 'react';
import { FileText, Download, Play, CheckCircle2, Clock, BookOpen, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

export default function ChapterView() {
  const [activeTab, setActiveTab] = useState<'Overview' | 'Content' | 'Resources' | 'Quiz'>('Overview');
  const [notes, setNotes] = useState('');
  const [activeChapterIndex, setActiveChapterIndex] = useState(1);

  const chapters = [
    {
      title: "Matter Around Us", progress: 100,
      lessons: ["States of Matter", "Properties", "Changes in State"],
      pdfName: "Chapter_1_Matter_Notes.pdf",
      simulatorName: "Particle Physics Simulator",
      takeaway: "Matter is anything that has mass and takes up space.",
      content: "Matter makes up everything around us. It exists in different states: solid, liquid, and gas."
    },
    {
      title: "Force and Motion", progress: 75,
      lessons: ["What is Force?", "Types of Force", "Newton’s Laws", "Applications"],
      pdfName: "Chapter_2_Force_and_Motion_Notes.pdf",
      simulatorName: "Force & Motion Simulator",
      takeaway: "Force is a push or pull that can change the motion of an object.",
      content: "Force is an interaction that changes the motion of an object. There are different types of forces including gravitational, frictional, and applied forces."
    },
    {
      title: "Light", progress: 60,
      lessons: ["Reflection", "Refraction", "Lenses", "Prisms"],
      pdfName: "Chapter_3_Light_Notes.pdf",
      simulatorName: "Optics & Light Simulator",
      takeaway: "Light travels in straight lines until it hits an object or changes medium.",
      content: "Light is a form of electromagnetic radiation that allows the human eye to see or makes objects visible. It shows both wave and particle properties."
    },
    {
      title: "Energy", progress: 40,
      lessons: ["Kinetic Energy", "Potential Energy", "Conservation", "Sources"],
      pdfName: "Chapter_4_Energy_Notes.pdf",
      simulatorName: "Energy Conservation Lab",
      takeaway: "Energy cannot be created or destroyed, only transformed from one form to another.",
      content: "Energy is the quantitative property that is transferred to a body or to a physical system, recognizable in the performance of work and in the form of heat and light."
    },
    {
      title: "Sound", progress: 20,
      lessons: ["Sound Waves", "Frequency", "Amplitude", "Speed of Sound"],
      pdfName: "Chapter_5_Sound_Notes.pdf",
      simulatorName: "Wave Interference Simulator",
      takeaway: "Sound is a mechanical wave that results from the back and forth vibration of the particles of the medium.",
      content: "Sound is a vibration that propagates as an acoustic wave, through a transmission medium such as a gas, liquid or solid."
    },
  ];

  const activeChapter = chapters[activeChapterIndex];

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

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
          <div className="text-sm text-gray-500 mb-1">Science • Chapter {activeChapterIndex + 1}</div>
          <h1 className="text-3xl font-semibold tracking-tight">Chapter {activeChapterIndex + 1}: {chapters[activeChapterIndex].title}</h1>
          <p className="text-gray-600 mt-1 max-w-2xl">Learn about {activeChapter.title.toLowerCase()} and its key principles.</p>

          <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Panel - Chapter Navigation */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-[24px] p-6 border border-gray-100 shadow-sm">
                <h4 className="font-semibold text-gray-900 mb-5 flex items-center gap-2"><BookOpen size={18} className="text-blue-500" /> Chapters</h4>
                <div className="space-y-2 mb-8">
                  {chapters.map((ch, idx) => (
                    <div
                      key={idx}
                      onClick={() => setActiveChapterIndex(idx)}
                      className={`px-4 py-3.5 rounded-2xl text-sm flex justify-between items-center cursor-pointer transition-all duration-300 ${activeChapterIndex === idx ? 'bg-blue-600 text-white font-medium shadow-md shadow-blue-500/30 -translate-y-0.5' : 'bg-gray-50 hover:bg-gray-100 text-gray-700'}`}
                    >
                      <span className="truncate pr-2">{ch.title}</span>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${activeChapterIndex === idx ? 'bg-white/20' : 'bg-white text-gray-600 shadow-sm'}`}>{ch.progress}%</span>
                    </div>
                  ))}
                </div>

                <h4 className="font-semibold text-gray-900 mb-4 text-sm flex items-center gap-2"><Clock size={16} className="text-emerald-500" /> Lessons in this Chapter</h4>
                <ul className="space-y-3">
                  {activeChapter.lessons.map((lesson, i) => (
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
                    <div className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl mb-8 shadow-sm hover:shadow-md hover:border-blue-100 transition-all gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 bg-red-50 text-red-500 rounded-xl flex items-center justify-center shrink-0">
                          <FileText size={24} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">{activeChapter.pdfName}</div>
                          <div className="text-xs text-gray-500 mt-0.5">2.4 MB • PDF Document</div>
                        </div>
                      </div>
                      <button className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold bg-gray-50 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors w-full sm:w-auto shrink-0">
                        <Download size={16} /> Download
                      </button>
                    </div>

                    {/* <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Play size={18} className="text-indigo-500" /> Interactive Content</h3>
                    <div className="group relative bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 rounded-3xl p-8 mb-8 text-white overflow-hidden shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-20 -mt-20 transition-transform group-hover:scale-110 duration-700"></div>
                      <div className="absolute bottom-0 left-0 w-32 h-32 bg-white opacity-5 rounded-full -ml-10 -mb-10 transition-transform group-hover:scale-110 duration-700"></div>
                      <div className="relative flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl flex items-center justify-center mb-5 shadow-inner">
                          <Play size={28} className="text-white ml-1" />
                        </div>
                        <h4 className="text-2xl font-bold mb-2">{activeChapter.simulatorName}</h4>
                        <p className="text-blue-100 text-sm mb-6 max-w-sm">Interactive physics visualization. Run experiments and see the results in real-time.</p>
                        <button className="px-6 py-2.5 bg-white text-blue-600 rounded-xl text-sm font-bold shadow-md hover:scale-105 transition-transform">Launch Simulator</button>
                      </div>
                    </div> */}

                    {/* <div className="flex gap-4 bg-emerald-50 border border-emerald-100 p-5 rounded-2xl">
                      <div className="text-emerald-500 mt-0.5"><CheckCircle2 size={20} /></div>
                      <div>
                        <strong className="block text-emerald-800 text-sm mb-1">Key Takeaway</strong>
                        <p className="text-sm text-emerald-700 leading-relaxed">{activeChapter.takeaway}</p>
                      </div>
                    </div> */}
                  </div>
                )}

                {activeTab === 'Content' && (
                  <div className="prose max-w-none text-gray-700">
                    <p>{activeChapter.content}</p>
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
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500 mt-1.5 font-medium">
                            <span className="flex items-center gap-1 shrink-0"><Clock size={14} className="text-gray-400" /> 15 Minutes</span>
                            <span className="flex items-center gap-1 shrink-0"><FileText size={14} className="text-gray-400" /> 5 Questions</span>
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-md border border-emerald-100 shrink-0">Passing: 60%</span>
                          </div>
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
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeDasharray={`${chapters[activeChapterIndex].progress}, 100`} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-gray-900">{chapters[activeChapterIndex].progress}%</span>
                    <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mt-1">Completed</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[24px] p-6 border border-gray-100 shadow-sm">
                <h4 className="font-semibold text-gray-900 mb-4">Upcoming Tasks</h4>
                <div className="space-y-3 text-sm">
                  <div className="p-3.5 bg-orange-50/50 border border-orange-100 text-orange-800 rounded-2xl flex items-start gap-3">
                    <Clock size={16} className="text-orange-500 mt-0.5 shrink-0" />
                    <div>
                      <div className="font-medium">Quiz: {activeChapter.title}</div>
                      <div className="text-xs text-orange-600 mt-1">Due Tomorrow</div>
                    </div>
                  </div>
                  <div className="p-3.5 bg-blue-50/50 border border-blue-100 text-blue-800 rounded-2xl flex items-start gap-3">
                    <FileText size={16} className="text-blue-500 mt-0.5 shrink-0" />
                    <div>
                      <div className="font-medium">Lesson Plan Submission</div>
                      <div className="text-xs text-blue-600 mt-1">In 3 Days</div>
                    </div>
                  </div>
                </div>
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
      </div>
    </div>
  );
}
