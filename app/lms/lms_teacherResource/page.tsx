'use client';

import BookResourcesPage from '@/app/library/book_resources/page';
import RequireStaff from '@/app/lms/_shared/RequireStaff';

export default function LmsTeacherResourcePage() {
  return (
    <RequireStaff>
      <BookResourcesPage />
    </RequireStaff>
  );
}
