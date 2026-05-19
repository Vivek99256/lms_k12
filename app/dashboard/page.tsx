'use client';

import React from 'react';
import { BookOpen, Calendar, FileText, BarChart3 } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

export default function Dashboard() {
  const stats = [
    { title: "Total Subjects", value: "06", growth: "+2", icon: BookOpen },
    { title: "Total Chapters", value: "28", growth: "+4", icon: Calendar },
    { title: "Total Courses", value: "12", growth: "+1", icon: FileText },
    { title: "Completed Assessments", value: "48", growth: "+12", icon: BarChart3 },
  ];

  const activities = [
    { title: "Science - Chapter 2 Quiz", time: "2 hours ago", icon: "📝" },
    { title: "Mathematics - Chapter 3", time: "Yesterday", icon: "📚" },
    { title: "English - Chapter 1 Quiz", time: "2 days ago", icon: "✍️" },
  ];

  const todos = [
    { task: "Review Science Quiz results", due: "Today", status: "Due soon" },
    { task: "Prepare Chapter 4 lesson plan", due: "May 22", status: "In progress" },
    { task: "Grade English essays", due: "May 25", status: "Upcoming" },
  ];

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <div className="flex-1 overflow-auto p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-semibold tracking-tight text-black">Welcome back, Teacher! 👋</h1>
            <p className="text-gray-600 mt-1 text-lg">Here's what's happening in your classroom today.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((stat, idx) => {
              const Icon = stat.icon;
              return (
                <div key={idx} className="card bg-white p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm text-gray-500 mb-1">{stat.title}</div>
                      <div className="text-4xl font-semibold tracking-tighter">{stat.value}</div>
                    </div>
                    <div className="w-11 h-11 bg-blue-50 text-[#0D6EFD] rounded-2xl flex items-center justify-center">
                      <Icon size={22} />
                    </div>
                  </div>
                  <div className="mt-4 text-xs flex items-center gap-1 text-emerald-600 font-medium">
                    <span>↑ {stat.growth}</span> 
                    <span className="text-gray-400">from last month</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="card bg-white p-7 lg:col-span-2">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="font-semibold text-xl">Assessment Overview</h3>
                  <p className="text-sm text-gray-500">Performance trends</p>
                </div>
                <select className="text-sm border rounded-full px-4 py-1.5 bg-white">
                  <option>Monthly</option>
                  <option>Weekly</option>
                </select>
              </div>
              <div className="h-72 flex items-end gap-3 px-4 pt-4">
                {[65, 78, 82, 75, 88, 92, 85, 95].map((val, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full bg-gradient-to-t from-[#0D6EFD] to-[#7ED957] rounded-t-xl" style={{height: `${val * 1.8}px`}}></div>
                    <span className="text-xs text-gray-400">W{i+1}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card bg-white p-7">
              <h3 className="font-semibold text-xl mb-5">Recent Activities</h3>
              <div className="space-y-5">
                {activities.map((act, i) => (
                  <div key={i} className="flex gap-4 items-start">
                    <div className="text-2xl mt-0.5">{act.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm leading-tight">{act.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{act.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card bg-white p-7 lg:col-span-3">
              <h3 className="font-semibold text-xl mb-5">To Do List</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {todos.map((todo, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 bg-gray-50 rounded-2xl">
                    <input type="checkbox" className="mt-1 accent-[#0D6EFD]" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{todo.task}</div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs px-3 py-0.5 bg-white rounded-full border text-gray-600">{todo.due}</span>
                        <span className="text-xs text-[#0D6EFD]">{todo.status}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
