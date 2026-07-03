'use client';

import { useState } from 'react';
import { Search, FileText, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import StudentProfilesTab from './components/student-profiles';
import DocumentTab from './components/document';

type TabKey = 'student-profiles' | 'document';

const tabs: { key: TabKey; label: string; icon: typeof User }[] = [
  { key: 'student-profiles', label: 'Student Profiles', icon: User },
  { key: 'document', label: 'Document', icon: FileText },
];

export default function SearchStudentPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('student-profiles');

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 ml-[15px] mt-[10px]">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px]">
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-0 bg-transparent shadow-none">
          <CardHeader className="shrink-0 bg-gradient-to-br from-gray-50/80 to-white pb-4 pt-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-8 w-1 rounded-full bg-gradient-to-b from-[#0D6EFD] to-[#7ED957]" />
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">Search / Edit Student</h1>
              </div>
              <p className="ml-3 text-sm text-gray-500">
                Search and manage student information and documents.
              </p>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-lg font-bold text-gray-800">
                <Search className="h-5 w-5 text-[#0D6EFD]" />
                Student Search
              </CardTitle>
            </div>

            {/* Tab Navigation */}
            <div className="mt-4 flex gap-2 border-b border-gray-200">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all relative',
                      isActive
                        ? 'text-[#0D6EFD]'
                        : 'text-gray-500 hover:text-gray-700'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                    {isActive && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0D6EFD] rounded-t-full" />
                    )}
                  </button>
                );
              })}
            </div>
          </CardHeader>

          <CardContent className="min-h-0 flex-1 overflow-auto p-5 md:p-6 lg:p-8 scrollbar-hide">
            {activeTab === 'student-profiles' && <StudentProfilesTab />}
            {activeTab === 'document' && <DocumentTab />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
