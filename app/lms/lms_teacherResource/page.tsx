'use client';

<<<<<<< HEAD
export { default } from '@/app/library/book_resources/page';
=======
import BookResourcesPage from '@/app/library/book_resources/page';
import RequireStaff from '@/app/lms/_shared/RequireStaff';

export default function LmsTeacherResourcePage() {
  return (
    <RequireStaff>
      <BookResourcesPage />
    </RequireStaff>
  );
}
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
