'use client';

import { AlumniForm } from '../_components/alumni-form';
import { PageFrame } from '../_components/alumni-ui';

export default function AddAlumniPage() {
  return (
    <PageFrame title="Add alumni" description="Register an alumnus manually. An Alumni ID is generated when you save.">
      <AlumniForm />
    </PageFrame>
  );
}
