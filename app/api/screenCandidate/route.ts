/**
 * API Route: /api/screenCandidate
 *
 * Ported as-is from G2G's `app/api/screenCandidate/route.ts`. Self-contained
 * (own external AI provider calls, own env vars) — no adaptation needed.
 * Screens candidate resumes against JD competencies and predicts fit.
 * Input: { resume: string, jdData: object }
 * Output: { competency_match, cultural_fit, predicted_success, summary, skill_gaps }
 *
 * Requires one of SCREENING_DEEPSEEK_API_KEY / OPENROUTER_API_KEY /
 * GEMINI_API_KEY to be configured in this repo's environment — otherwise it
 * answers 503. Called fire-and-forget from
 * `recruitment/components/candidate-application-form.tsx` after an
 * application is submitted; its failure does not block the application save.
 */

import { NextRequest, NextResponse } from 'next/server';

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
// `gemini-3.6-flash` does not exist as a Gemini model - Google's API answers
// requests for it with a misleading 503 "This model is currently
// experiencing high demand" instead of a clear "model not found", which is
// exactly the error this route was surfacing to the frontend. Verified live
// against this repo's configured GEMINI_API_KEY: `gemini-2.5-flash` (the
// model this same repo's other Gemini integration,
// AnalyzeJDController::analyze() in the backend, already uses successfully).
const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

interface ProviderErrorBody {
  error?: { message?: string };
  message?: string;
}

async function requestScreening(
  endpoint: string,
  apiKey: string,
  model: string,
  prompt: string
) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 700,
    }),
  });

  if (!response.ok) {
    let message = `Provider returned HTTP ${response.status}`;
    try {
      const body = await response.json() as ProviderErrorBody;
      message = body.error?.message || body.message || message;
    } catch {
      // Preserve the HTTP status when the provider does not return JSON.
    }
    throw new Error(message);
  }

  return response.json();
}

async function requestGeminiScreening(apiKey: string, prompt: string) {
  const response = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        // gemini-2.5-flash spends part of maxOutputTokens on internal
        // "thinking" before writing the visible answer - for a small,
        // deterministic JSON-extraction task like this, that thinking pass
        // can consume the whole budget and leave zero tokens for the actual
        // response text, which silently produced the "Unable to analyze"
        // fallback below (empty content, not an error). Disabling it and
        // raising the budget keeps the full allowance for the JSON output.
        thinkingConfig: { thinkingBudget: 0 },
        maxOutputTokens: 1024,
        temperature: 0.4,
      },
    }),
  });

  const body = await response.json() as {
    error?: { message?: string };
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  if (!response.ok) {
    throw new Error(body.error?.message || `Gemini API returned HTTP ${response.status}`);
  }

  return {
    choices: [{
      message: {
        content: body.candidates?.[0]?.content?.parts?.[0]?.text || '{}',
      },
    }],
  };
}

export async function POST(req: NextRequest) {
  try {
    const { resume, jdData } = await req.json();

    if (!resume || !jdData) {
      return NextResponse.json({ error: 'Missing resume or JD data' }, { status: 400 });
    }

    const deepSeekApiKey = process.env.SCREENING_DEEPSEEK_API_KEY;
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!deepSeekApiKey && !openRouterApiKey && !geminiApiKey) {
      return NextResponse.json(
        { error: 'Candidate screening is not configured' },
        { status: 503 }
      );
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

    let providerData;
    if (deepSeekApiKey) {
      try {
        providerData = await requestScreening(
          DEEPSEEK_ENDPOINT,
          deepSeekApiKey,
          'deepseek-chat',
          screeningPrompt
        );
      } catch (deepSeekError) {
        if (!openRouterApiKey) throw deepSeekError;
        console.warn(
          'Direct DeepSeek screening failed; retrying through OpenRouter:',
          deepSeekError instanceof Error ? deepSeekError.message : 'Unknown provider error'
        );
      }
    }

    if (!providerData && openRouterApiKey) {
      try {
        providerData = await requestScreening(
          OPENROUTER_ENDPOINT,
          openRouterApiKey,
          'deepseek/deepseek-chat',
          screeningPrompt
        );
      } catch (openRouterError) {
        console.warn(
          'OpenRouter (deepseek/deepseek-chat) screening failed; retrying through free OpenRouter models:',
          openRouterError instanceof Error ? openRouterError.message : 'Unknown provider error'
        );
        // The paid model can fail on account credit/rate limits alone (seen
        // in practice: "requires more credits... can only afford N"), which
        // has nothing to do with whether OpenRouter itself is reachable or
        // configured correctly. Retrying against OpenRouter's free-tier
        // models (no credit cost) recovers exactly that case using the
        // same, already-configured OPENROUTER_API_KEY - no new provider or
        // credential needed. Free models sit behind a shared, rate-limited
        // pool and individually 429 fairly often, so more than one is tried
        // in sequence before falling through to Gemini.
        for (const freeModel of ['openai/gpt-oss-20b:free', 'nvidia/nemotron-nano-9b-v2:free']) {
          try {
            providerData = await requestScreening(OPENROUTER_ENDPOINT, openRouterApiKey, freeModel, screeningPrompt);
            break;
          } catch (freeModelError) {
            console.warn(
              `Free OpenRouter model ${freeModel} failed:`,
              freeModelError instanceof Error ? freeModelError.message : 'Unknown provider error'
            );
          }
        }
      }
    }

    if (!providerData && geminiApiKey) {
      providerData = await requestGeminiScreening(geminiApiKey, screeningPrompt);
    }

    if (!providerData) throw new Error('No screening provider is available');
    const content = providerData.choices?.[0]?.message?.content || '{}';

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
    console.error('Candidate screening error:', error);
    return NextResponse.json(
      { error: 'Failed to screen candidate', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
