import { NextRequest, NextResponse } from 'next/server';
import { buildPalContentModelPayload } from '@/app/pal/data/pal-content-model';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const chapterId = request.nextUrl.searchParams.get('chapterId') ?? undefined;
  const concept = request.nextUrl.searchParams.get('concept') ?? undefined;

  try {
    const payload = await buildPalContentModelPayload({ chapterId, concept });
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        context: null,
        frameworkModules: {},
        uluModules: {},
        error: error instanceof Error ? error.message : 'PAL backend content-model request failed.',
        isReady: false,
      },
      { status: 500 }
    );
  }
}
