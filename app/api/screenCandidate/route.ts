/**
 * API Route: /api/screenCandidate
 *
 * Screens candidate resumes against JD competencies and predicts fit.
 * Input: { resume: string, jdData: object }
 * Output: { competency_match, cultural_fit, predicted_success, summary, skill_gaps }
 *
 * The model call goes through the Laravel backend's AI Providers (module `recruitment_ai`):
 * provider, model, credential, priority and fallback are whatever is saved there. This route
 * holds no provider key, and answers 503 with the backend's own message when the module has no
 * usable configuration. Called fire-and-forget from
 * `recruitment/components/candidate-application-form.tsx` after an application is submitted;
 * its failure does not block the application save.
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/security/rate-limit';
import { requireSession } from '@/lib/security/session-token';
import { BackendCompletionError, completeViaBackend } from '@/lib/ai/backend-complete';

/** A resume is a few pages; anything far longer is not a resume. */
const MAX_RESUME_CHARS = 60_000;

export async function POST(req: NextRequest) {
  // Each call spends paid LLM credit: signed-in staff only, and not in bulk.
  const session = requireSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Sign in to screen candidates.' }, { status: 401 });
  }
  const limited = rateLimit(req, 'screen-candidate', { limit: 20, windowMs: 60_000, key: session.claims.id });
  if (limited) return limited;

  try {
    const { resume, jdData } = await req.json();

    if (!resume || !jdData) {
      return NextResponse.json({ error: 'Missing resume or JD data' }, { status: 400 });
    }
    if (typeof resume !== 'string' || resume.length > MAX_RESUME_CHARS || typeof jdData !== 'object') {
      return NextResponse.json({ error: 'The resume or JD data is not in the expected form.' }, { status: 400 });
    }

    const screeningPrompt = `You are an expert recruiter. Analyze this candidate's resume against the job requirements.

Job Requirements:
- Core Skills: ${jdData.core_skills?.join(', ') || 'Not specified'}
- Behavioral Traits: ${jdData.behavioral_traits?.join(', ') || 'Not specified'}
- Required Competency Levels: ${JSON.stringify(jdData.competency_level || {})}

Candidate Resume:
${resume}

Provide analysis in valid JSON format:
{
  "competency_match": <number 0-100>,
  "cultural_fit": "Low" | "Medium" | "High",
  "predicted_success": "Unlikely" | "Possible" | "Likely" | "Highly Likely",
  "summary": "<150 word summary of candidate fit>",
  "skill_gaps": ["skill1", "skill2"],
  "strengths": ["strength1", "strength2"],
  "recommendation": "Schedule Interview" | "Request Additional Info" | "Reject"
}`;

    // Provider, model, credential and fallback order all come from AI Providers (recruitment_ai).
    const completion = await completeViaBackend(req, {
      module: 'recruitment_ai',
      messages: [{ role: 'user', content: screeningPrompt }],
      json: true,
      temperature: 0.4,
      maxTokens: 1024,
    });
    const content = completion.text || '{}';

    let analysis: Record<string, unknown>;
    try {
      analysis = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : {
        competency_match: 0,
        cultural_fit: 'Low',
        predicted_success: 'Unlikely',
        summary: 'Unable to analyze',
        skill_gaps: [],
        strengths: [],
        recommendation: 'Request Additional Info'
      };
    }

    const skillMatchDetails = jdData.core_skills?.map((skill: string) => {
      const skillLower = skill.toLowerCase();
      const resumeLower = resume.toLowerCase();
      const isPresent = resumeLower.includes(skillLower);
      const requiredLevel = jdData.competency_level?.[skill] || 'Intermediate';

      return {
        skill,
        present: isPresent,
        required_level: requiredLevel,
        gap: !isPresent
      };
    }) || [];

    return NextResponse.json({
      success: true,
      competency_match: analysis.competency_match || 0,
      cultural_fit: analysis.cultural_fit || 'Medium',
      predicted_success: analysis.predicted_success || 'Possible',
      summary: analysis.summary || 'Analysis complete',
      skill_gaps: analysis.skill_gaps || [],
      strengths: analysis.strengths || [],
      recommendation: analysis.recommendation || 'Request Additional Info',
      skill_match_details: skillMatchDetails,
      total_skills_required: jdData.core_skills?.length || 0,
      skills_matched: skillMatchDetails.filter((s: { present: boolean }) => s.present).length
    });

  } catch (error) {
    if (error instanceof BackendCompletionError && error.kind === 'not_configured') {
      // The backend says what an administrator has to set up; that is safe and useful to show.
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof BackendCompletionError && error.kind === 'quota') {
      return NextResponse.json({ error: 'The AI provider quota is exhausted. Try again later.' }, { status: 429 });
    }
    console.error('Candidate screening error:', error);
    return NextResponse.json(
      // Provider error text stays in the server log; it can carry request ids and key hints.
      { error: 'Failed to screen candidate' },
      { status: 500 }
    );
  }
}
