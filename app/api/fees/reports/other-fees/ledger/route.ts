import type { NextRequest } from 'next/server';

import { proxyFeesReportTextGet } from '@/app/api/fees/reports/_lib/fees-report-proxy';

export async function GET(request: NextRequest) {
  return proxyFeesReportTextGet(request, '/fees/ajax_ledgerData');
}
