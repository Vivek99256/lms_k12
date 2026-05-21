'use client';

import React from 'react';
import Link from 'next/link';
import { BrainCircuit, Sparkles, Clock, Target, Award, Bell } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

export default function QuizPage() {
  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        
        <div className="flex-1 overflow-y-auto relative p-8">
          <div className="min-h-full flex items-center justify-center">
          {/* Background Decorative Elements */}
          <div className="absolute top-20 left-10 w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDuration: '4s' }}></div>
          <div className="absolute top-40 right-10 w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDuration: '5s' }}></div>
          <div className="absolute -bottom-8 left-1/3 w-96 h-96 bg-emerald-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDuration: '6s' }}></div>

          {/* Main Card */}
          <div className="relative bg-white/60 backdrop-blur-3xl border border-white p-10 md:p-14 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] max-w-3xl w-full text-center flex flex-col items-center">
            
            {/* Animated Icon Container */}
            <div className="relative mb-8 group cursor-default">
              <div className="absolute inset-0 bg-[#0D6EFD] rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-700"></div>
              <div className="relative w-28 h-28 bg-gradient-to-br from-[#0D6EFD] to-indigo-600 rounded-[2rem] flex items-center justify-center shadow-lg shadow-blue-500/30 transform transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3">
                <BrainCircuit size={54} className="text-white" strokeWidth={1.5} />
                <Sparkles size={28} className="absolute -top-3 -right-3 text-yellow-400 animate-bounce" style={{ animationDuration: '3s' }} />
              </div>
            </div>

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-sm font-semibold mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              In Development
            </div>

            <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-slate-800 to-gray-900 mb-6 tracking-tight">
              Interactive Quizzes <br className="hidden md:block"/> <span className="text-[#0D6EFD]">Coming Soon</span>
            </h1>
            
            <p className="text-gray-500 text-lg mb-12 max-w-xl leading-relaxed">
              We're crafting a next-generation assessment experience. Get ready for gamified quizzes, real-time analytics, and personalized learning paths designed to make learning engaging.
            </p>

            {/* Feature Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
              <div className="flex flex-col items-center p-6 rounded-3xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1">
                <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-4">
                  <Target size={24} />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Adaptive Learning</h3>
                <p className="text-sm text-gray-500 text-center leading-relaxed">Questions that adapt to every student's learning pace</p>
              </div>
              <div className="flex flex-col items-center p-6 rounded-3xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1">
                <div className="w-12 h-12 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center mb-4">
                  <Clock size={24} />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Real-time Insights</h3>
                <p className="text-sm text-gray-500 text-center leading-relaxed">Instant feedback and live performance tracking</p>
              </div>
              <div className="flex flex-col items-center p-6 rounded-3xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mb-4">
                  <Award size={24} />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Gamified System</h3>
                <p className="text-sm text-gray-500 text-center leading-relaxed">Earn badges, maintain streaks, and climb leaderboards</p>
              </div>
            </div>

            <div className="flex gap-4 mt-12">
              <Link href="/quiz/create" className="bg-[#0D6EFD] hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-semibold shadow-lg shadow-blue-500/30 transition-all duration-300 hover:-translate-y-1 flex items-center gap-2 group">
                Create New Quiz
              </Link>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}
