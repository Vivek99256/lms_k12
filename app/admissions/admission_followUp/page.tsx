"use client";

import React, { useState } from 'react';
import { Plus, ArrowRight } from 'lucide-react';

interface FollowUpTask {
  id: string;
  day: string;
  weekday: string;
  time: string;
  type: 'Call' | 'Visit' | 'Reminder';
  title: string;
}

interface CommunicationLog {
  id: string;
  initials: string;
  actor: string;
  actionText: string;
  target: string;
  timeAgo: string;
  bgColor: string;
  textColor: string;
}

export default function FollowUpsContentOnly() {
  const [tasks] = useState<FollowUpTask[]>([
    { id: 't1', day: '04', weekday: 'FRI', time: '10:00', type: 'Call', title: 'Call — Diya Menon (Grade 6)' },
    { id: 't2', day: '04', weekday: 'FRI', time: '11:30', type: 'Call', title: 'Call — Ananya Iyer (Grade 3)' },
    { id: 't3', day: '05', weekday: 'SAT', time: '09:30', type: 'Visit', title: 'Campus visit — Aarav Sharma' },
    { id: 't4', day: '05', weekday: 'SAT', time: '14:00', type: 'Reminder', title: 'Reminder — Reyansh Joshi application' },
    { id: 't5', day: '06', weekday: 'SUN', time: '10:00', type: 'Visit', title: 'Campus visit — Kabir Rao (LKG)' },
    { id: 't6', day: '06', weekday: 'SUN', time: '16:00', type: 'Call', title: 'Call — Zara Khan' },
  ]);

  const communicationLogs: CommunicationLog[] = [
    { id: 'c1', initials: 'PN', actor: 'Priya N.', actionText: 'logged a call with', target: 'Diya Menon', timeAgo: '12m ago', bgColor: 'bg-indigo-50', textColor: 'text-indigo-600' },
    { id: 'c2', initials: 'S', actor: 'System', actionText: 'sent an application reminder to', target: 'Reyansh Joshi', timeAgo: '1h ago', bgColor: 'bg-slate-100', textColor: 'text-slate-600' },
    { id: 'c3', initials: 'RK', actor: 'Rahul K.', actionText: 'scheduled a campus visit for', target: 'Kabir Rao', timeAgo: '2h ago', bgColor: 'bg-amber-50', textColor: 'text-amber-600' },
    { id: 'c4', initials: 'PN', actor: 'Priya N.', actionText: 'converted enquiry for', target: 'Vivaan Nair', timeAgo: '5h ago', bgColor: 'bg-indigo-50', textColor: 'text-indigo-600' },
  ];

  // Action Handlers
  const handleNewReminder = () => alert('Opening "New Reminder" creation modal...');
  const handleTaskClick = (task: FollowUpTask) => alert(`Opening detailed workspace for: ${task.title}`);
  const handleLogClick = (log: CommunicationLog) => alert(`Viewing history audit trail for ${log.target}`);

  const getDotColor = (type: FollowUpTask['type']) => {
    switch (type) {
      case 'Call': return 'bg-blue-500';
      case 'Visit': return 'bg-amber-500';
      case 'Reminder': return 'bg-indigo-500';
    }
  };

  return (
    <div className="p-8 bg-[#f4f6fa] min-h-screen font-sans antialiased text-slate-800">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Section: Scheduled Follow-ups Panel */}
        <section className="lg:col-span-7 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8 border-b border-[#ddd] pb-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Scheduled follow-ups</h2>
              <p className="text-sm text-slate-500 mt-0.5">Upcoming tasks and automated reminders</p>
            </div>
            <button 
              onClick={handleNewReminder}
              className="px-3.5 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50/70 hover:bg-indigo-100/90 rounded-lg transition-all flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" /> New reminder
            </button>
          </div>

          {/* Agenda Feed */}
          <div className="space-y-4">
            {tasks.map((task, index) => {
              const showDateBlock = index === 0 || tasks[index - 1].day !== task.day;

              return (
                <div key={task.id} className={`flex items-start gap-4 ${showDateBlock ? "" : "border-b border-[#ddd] pb-3"}`}>
                  {/* Date Badge Column */}
                  <div className="w-10 flex flex-col items-center justify-center text-center select-none pt-1">
                    {showDateBlock ? (
                      <>
                        <span className="text-xl font-extrabold text-slate-900 tracking-tight leading-none">{task.day}</span>
                        <span className="text-[10px] font-bold text-slate-400 tracking-wider mt-1 uppercase">{task.weekday}</span>
                      </>
                    ) : (
                      <div className="w-1.5 h-1.5 bg-slate-200 rounded-full mt-3" />
                    )}
                  </div>

                  {/* Time indicator */}
                  <span className="text-sm mt-3 font-medium text-slate-500 font-mono tracking-tight w-11">
                    {task.time}
                  </span>

                  {/* Task Card Layout Component */}
                  <div 
                    onClick={() => handleTaskClick(task)}
                    className="flex-1 bg-[#f8fafc] hover:bg-[#f1f5f9] border border-slate-100 rounded-xl p-3.5 flex items-center justify-between transition-all cursor-pointer group shadow-sm hover:shadow"
                  >
                    <div className="flex items-center gap-4">
                      {/* Interactive Colored Bullet Dot Indicator */}
                      <span className={`w-2 h-2 rounded-full shrink-0 ${getDotColor(task.type)}`} />

                      <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">
                        {task.title}
                      </span>
                    </div>
                    
                    <ArrowRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-4px] group-hover:translate-x-0 ml-1" />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right Section: Recent Communication Stream Panel */}
        <section className="lg:col-span-5 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="mb-6 border-b border-[#ddd] pb-3">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Recent communication</h2>
            <p className="text-sm text-slate-500 mt-0.5">Activity across enquiries this week</p>
          </div>

          {/* Log List configuration */}
          <div className="space-y-1">
            {communicationLogs.map((log) => (
              <div 
                key={log.id}
                onClick={() => handleLogClick(log)}
                className="p-3 rounded-xl flex items-start gap-3.5 hover:bg-slate-50 transition-colors cursor-pointer group border-b border-[#ddd]"
              >
                {/* Initials Sphere */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold tracking-wider shrink-0 border border-transparent ${log.bgColor} ${log.textColor}`}>
                  {log.initials}
                </div>

                {/* Body Content Description */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-sm text-slate-600 leading-normal">
                    <strong className="text-slate-900 font-semibold">{log.actor}</strong>{' '}
                    {log.actionText}{' '}
                    <span className="text-indigo-600 font-semibold group-hover:text-indigo-700 transition-colors">
                      {log.target}
                    </span>
                  </p>
                  <span className="block text-xs text-slate-400 font-medium mt-1">
                    {log.timeAgo}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}