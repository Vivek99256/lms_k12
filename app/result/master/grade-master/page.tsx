'use client';

import { useState } from 'react';
import { Ruler, Scale } from 'lucide-react';
import MasterCrud from '@/components/result/MasterCrud';
import PageHeader from '@/components/result/PageHeader';
import { Tabs } from '@/components/result/primitives';
import { gradeDataMaster, gradeScaleMaster } from '@/lib/result/masters';

/**
 * Grade master — the Blade screen showed one tab strip per grade scale
 * with inline data rows. Modernised as two clear tabs:
 *  • Grade scales — named scales (add type)
 *  • Grade data   — break-offs / GP values / comments per scale (add rows)
 */
export default function GradeMasterPage() {
  const [tab, setTab] = useState('grade-scale');

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto space-y-6">
        <PageHeader
          icon={Scale}
          title="Grade master"
          subtitle="Grading scales and their break-off / GP definitions"
          breadcrumbs={[{ label: 'Result', href: '/result' }, { label: 'Masters', href: '/result' }, { label: 'Grade master' }]}
        />

        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { id: 'grade-scale', label: 'Grade scales', icon: <Scale /> },
            { id: 'grade-data', label: 'Grade data', icon: <Ruler /> },
          ]}
        />

        {tab === 'grade-scale' ? (
          <MasterCrud key="grade-scale" screen={gradeScaleMaster} embedded />
        ) : (
          <MasterCrud key="grade-data" screen={gradeDataMaster} embedded />
        )}
      </div>
    </div>
  );
}
