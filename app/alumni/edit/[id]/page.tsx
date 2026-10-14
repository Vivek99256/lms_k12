'use client';

import { use, useEffect, useState } from 'react';
import { AlumniForm } from '../../_components/alumni-form';
import { Banner, LoadingBlock, PageFrame } from '../../_components/alumni-ui';
import { alumniApi, type AlumniDetail } from '../../_lib/alumni-api';

export default function EditAlumniPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [alumni, setAlumni] = useState<AlumniDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    alumniApi
      .show(id, controller.signal)
      .then((profile) => setAlumni(profile.alumni))
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(reason instanceof Error ? reason.message : "Couldn't load the alumni record. Try again.");
      });
    return () => controller.abort();
  }, [id]);

  return (
    <PageFrame title="Edit alumni" description={alumni ? `${alumni.full_name} · ${alumni.alumni_code}` : undefined}>
      {error ? <Banner>{error}</Banner> : alumni ? <AlumniForm initial={alumni} /> : <LoadingBlock />}
    </PageFrame>
  );
}
