import type { NextRequest } from 'next/server';

import { proxyFeesReportGet } from '@/app/api/fees/reports/_lib/fees-report-proxy';

export async function GET(request: NextRequest) {
  return proxyFeesReportGet(request, '/fees/otherNew_cancel_fees_report/create');
}
