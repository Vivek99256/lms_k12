import type { NextRequest } from 'next/server';

import { proxyFeesReportPost } from '@/app/api/fees/reports/_lib/fees-report-proxy';

export async function POST(request: NextRequest) {
  return proxyFeesReportPost(request, '/fees/fees_structure_report');
}
