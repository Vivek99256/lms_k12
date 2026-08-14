import { NextRequest, NextResponse } from 'next/server';
import { fetchPedagogyEngineModule } from '@/app/pal/data/pedagogy-engine';

export const runtime = 'nodejs';

/**
 * Same-origin entry point for the PAL Pedagogy Engine UI.
 *
 * Forwards the chapter / concept selection to the Laravel endpoint
 * (GET /api/pal/pedagogy-engine) and returns that payload as-is. No rule data
 * and no rule execution happen here -- the backend owns both, reading the
 * concept out of `semantic_intelligence`.
 */
export async function GET(request: NextRequest) {
  try {
    const payload = await fetchPedagogyEngineModule({
      chapterId: request.nextUrl.searchParams.get('chapterId') ?? undefined,
      concept: request.nextUrl.searchParams.get('concept') ?? undefined,
    });
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        module: null,
        error: error instanceof Error ? error.message : 'The Pedagogy Engine request failed.',
        isReady: false,
      },
      { status: 500 }
    );
  }
}
