'use client';

/**
 * Certifications & Records — G2G LMS migration (Package 3).
 * Mounts the ported `CertificationsRecords` screen at
 * `/people-competency/lms/certifications-records`
 * (routeMapper key `g2g_lms.certifications_records`).
 */

import { CertificationsRecords } from '@/components/domain/lms/certifications-records';

export default function CertificationsRecordsPage() {
  return <CertificationsRecords />;
}
