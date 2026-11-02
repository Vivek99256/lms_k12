'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, UserCheck } from 'lucide-react';
import { isStudentSession } from '@/app/pal/data/pal-lookups';
import { useViewAsStudent, setViewAsStudent } from '@/app/pal/data/pal-view-as';
import type { PalStudentSelection } from '@/app/pal/data/pal';
import StudentPicker from '@/app/pal/_components/StudentPicker';
import ViewAsBanner from '@/app/pal/_components/ViewAsBanner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyChapterState } from './_components/EmptyChapterState';
import { MountainJourneyView } from './_components/MountainJourneyView';

/**
 * `/pal/journey?chapterId=` — Dynamic Learning Journey.
 *
 * Displays the complete actual student learning history through the 7 core stages:
 * Chapter Diagnostic -> Concept Diagnostic -> Plan -> Learn -> Practice -> Check -> Mastery.
 *
 * Dynamically displays every real step, including repeated cycles through Learn, Practice,
 * and Check, where the student got stuck, time spent, repeat reasons, and teacher diagnostics.
 */
export default function PalJourneyPage() {
  return (
    <Suspense
      fallback={
        <Centered>
          <Loader2 className="h-5 w-5 animate-spin" />
        </Centered>
      }
    >
      <PalJourneyPageContent />
    </Suspense>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[50vh] items-center justify-center text-slate-500">{children}</div>;
}

function PalJourneyPageContent() {
  const searchParams = useSearchParams();
  const chapterId = searchParams.get('chapterId') ?? '';
  const paramStudentId = searchParams.get('studentId') ?? '';
  const isStudent = isStudentSession();
  const viewAs = useViewAsStudent();

  const [selectedStudent, setSelectedStudent] = useState<PalStudentSelection | null>(() => {
    if (paramStudentId) {
      return {
        studentId: paramStudentId,
        name: `Student #${paramStudentId}`,
        gradeId: '',
        standardId: '',
      };
    }
    return viewAs;
  });

  useEffect(() => {
    if (paramStudentId && (!selectedStudent || selectedStudent.studentId !== paramStudentId)) {
      setSelectedStudent({
        studentId: paramStudentId,
        name: `Student #${paramStudentId}`,
        gradeId: '',
        standardId: '',
      });
    } else if (!paramStudentId && viewAs) {
      setSelectedStudent(viewAs);
    }
  }, [paramStudentId, viewAs]);

  if (!chapterId) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <EmptyChapterState />
      </div>
    );
  }

  // Teacher or staff viewing the journey
  if (!isStudent) {
    const effectiveStudentId = selectedStudent?.studentId;

    if (!effectiveStudentId) {
      return (
        <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6">
          <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50/60 via-white to-purple-50/40 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-xs">
                  <UserCheck className="h-4 w-4" />
                </span>
                <div>
                  <CardTitle className="text-lg text-slate-900">
                    Teacher Learning Journey Monitor
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-600">
                    Select a student to inspect their dynamic multi-step learning path, repeated Learn/Practice attempts, stuck points, and diagnostic insights for Chapter {chapterId}.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <StudentPicker
                audience="Teacher"
                onSelect={(student) => {
                  setSelectedStudent(student);
                  setViewAsStudent(student);
                }}
              />
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6">
        <ViewAsBanner
          student={selectedStudent}
          audience="Teacher"
          onExit={() => {
            setSelectedStudent(null);
            setViewAsStudent(null);
          }}
        />

        <MountainJourneyView
          chapterId={chapterId}
          viewContext={{ mode: 'monitor', studentId: effectiveStudentId, readOnly: true }}
        />
      </div>
    );
  }

  // Enrolled student viewing their own journey
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6">
      <MountainJourneyView chapterId={chapterId} />
    </div>
  );
}
