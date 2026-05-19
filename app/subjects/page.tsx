'use client';

import React from 'react';
import { Plus, ArrowRight, BookOpen, MoreVertical } from 'lucide-react';
import Link from 'next/link';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const subjects = [
  { name: "Mathematics", chapters: 5, progress: 80, color: "bg-blue-500" },
  { name: "Science", chapters: 5, progress: 65, color: "bg-emerald-500" },
  { name: "English", chapters: 4, progress: 90, color: "bg-purple-500" },
  { name: "Social Science", chapters: 6, progress: 45, color: "bg-orange-500" },
  { name: "Computer", chapters: 3, progress: 75, color: "bg-cyan-500" },
  { name: "Gujarati", chapters: 4, progress: 55, color: "bg-pink-500" },
];

export default function SubjectsPage() {
  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      <div className="w-72"><Sidebar /></div>
      <div className="flex-1 flex flex-col">
        <Header />
        
        <div className="p-8 flex-1 overflow-auto">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h1 className="text-4xl font-semibold">Subjects</h1>
              <p className="text-gray-600 mt-1">Manage and explore your subjects</p>
            </div>
            <button className="flex items-center gap-2 bg-[#0D6EFD] hover:bg-blue-700 text-white px-6 py-3 rounded-2xl text-sm font-medium shadow">
              <Plus size={18} /> Add Subject
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {subjects.map((subject, index) => (
              <div key={index} className="group relative bg-white rounded-[20px] p-5 border border-gray-100 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all duration-300 ease-in-out hover:-translate-y-1 overflow-hidden">
                {/* Background Decoration */}
                <div className={`absolute top-0 right-0 w-24 h-24 ${subject.color} opacity-5 rounded-bl-full -mr-6 -mt-6 transition-transform duration-500 group-hover:scale-110`}></div>
                
                <div className="flex justify-between items-start mb-4 relative">
                  <div className={`${subject.color} w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-md`}>
                    {subject.name[0]}
                  </div>
                  <button className="text-gray-400 hover:text-gray-600 p-1.5 transition-colors">
                    <MoreVertical size={18} />
                  </button>
                </div>
                
                <div className="relative">
                  <h3 className="font-semibold text-lg text-gray-900 mb-0.5 group-hover:text-blue-600 transition-colors">{subject.name}</h3>
                  <div className="flex items-center text-xs text-gray-500 mb-3 gap-1.5">
                    <BookOpen size={14} className="text-gray-400" />
                    <span>{subject.chapters} Chapters</span>
                  </div>
                </div>
                
                <div className="mb-4 relative">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-gray-600 font-medium">Progress</span>
                    <span className="font-bold text-gray-900">{subject.progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${subject.color} rounded-full transition-all duration-1000 ease-out`} style={{width: `${subject.progress}%`}}></div>
                  </div>
                </div>

                <Link href="/chapters" className="relative flex items-center justify-center gap-2 w-full py-2.5 text-center text-sm font-semibold text-gray-700 bg-gray-50 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-all duration-300">
                  Open Subject
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-gray-400 mt-8">Showing 1 to 6 of 6 subjects</p>
        </div>
      </div>
    </div>
  );
}
