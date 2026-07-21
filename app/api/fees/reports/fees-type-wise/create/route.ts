import type { NextRequest } from 'next/server';

import { proxyFeesReportGet } from '@/app/api/fees/reports/_lib/fees-report-proxy';

export async function GET(request: NextRequest) {
  return proxyFeesReportGet(request, '/fees/fees_type_wise_report/create');
}
