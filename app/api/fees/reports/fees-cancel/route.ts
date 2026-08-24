import type { NextRequest } from 'next/server';

import { proxyFeesReportGet, proxyFeesReportPost } from '@/app/api/fees/reports/_lib/fees-report-proxy';

export async function GET(request: NextRequest) {
  return proxyFeesReportGet(request, '/fees/fees_cancel_report_index');
}

export async function POST(request: NextRequest) {
  return proxyFeesReportPost(request, '/fees/fees_cancel_report');
}
