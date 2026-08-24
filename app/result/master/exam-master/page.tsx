'use client';

import { useState } from 'react';
import { BookMarked, BookOpenCheck } from 'lucide-react';
import MasterCrud from '@/components/result/MasterCrud';
import PageHeader from '@/components/result/PageHeader';
import { Tabs } from '@/components/result/primitives';
import { examMaster, examTypeMaster } from '@/lib/result/masters';

/**
 * Exam master — two related reference lists combined into one tabbed
 * screen (the Blade version linked them as separate sub-pages):
 *  • Exam master  — exam types mapped to standards/terms with weightage
 *  • Exam type master — coded exam type reference list
 */
export default function ExamMasterPage() {
  const [tab, setTab] = useState('exam-master');

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto space-y-6">
        <PageHeader
          icon={BookOpenCheck}
          title="Exam master"
          subtitle="Manage exam types, their standards, terms, weightage and codes"
          breadcrumbs={[{ label: 'Result', href: '/result' }, { label: 'Masters', href: '/result' }, { label: 'Exam master' }]}
        />

        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { id: 'exam-master', label: 'Exam master', icon: <BookOpenCheck /> },
            { id: 'exam-type-master', label: 'Exam type master', icon: <BookMarked /> },
          ]}
        />

        {tab === 'exam-master' ? (
          <MasterCrud key="exam-master" screen={examMaster} embedded />
        ) : (
          <MasterCrud key="exam-type-master" screen={examTypeMaster} embedded />
        )}
      </div>
    </div>
  );
}
