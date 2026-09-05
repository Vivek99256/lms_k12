'use client';

import { Compass } from 'lucide-react';
import { CounsellingCourses } from './CounsellingCourses';

export function InterestProfileHub() {
  return (
    <div className="space-y-5 p-1 md:p-2">
      <header className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Compass className="size-4" />
          Career counselling
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Interest profile</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Counselling courses and personality assessments to help you learn more about yourself.
        </p>
      </header>

      <CounsellingCourses />
    </div>
  );
}
