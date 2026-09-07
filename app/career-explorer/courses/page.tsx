import { Suspense } from 'react';
import CourseProfileHub from './CourseProfileHub';

export default function CourseProfilePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading courses…</div>}>
      <CourseProfileHub />
    </Suspense>
  );
}
