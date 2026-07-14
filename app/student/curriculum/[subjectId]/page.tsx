import { redirect } from 'next/navigation';

export default async function StudentCurriculumPage({
  params,
  searchParams,
}: {
  params: Promise<{ subjectId: string }>;
  searchParams: Promise<{
    section_id?: string;
    section_name?: string;
    standard_id?: string;
    sub_institute_id?: string;
    syear?: string;
  }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const nextParams = new URLSearchParams({
    view: 'curriculum',
    subject_id: resolvedParams.subjectId,
  });

  if (resolvedSearchParams.standard_id) {
    nextParams.set('standard_id', resolvedSearchParams.standard_id);
  }
  if (resolvedSearchParams.section_id) {
    nextParams.set('section_id', resolvedSearchParams.section_id);
  }
  if (resolvedSearchParams.section_name) {
    nextParams.set('section_name', resolvedSearchParams.section_name);
  }
  if (resolvedSearchParams.sub_institute_id) {
    nextParams.set('sub_institute_id', resolvedSearchParams.sub_institute_id);
  }
  if (resolvedSearchParams.syear) {
    nextParams.set('syear', resolvedSearchParams.syear);
  }

  redirect(`/student?${nextParams.toString()}`);
}
