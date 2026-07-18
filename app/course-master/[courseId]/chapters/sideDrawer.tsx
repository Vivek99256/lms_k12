// sideDrawer.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { X, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Chapter } from '../../data/chapters';
import type { Course } from '../../data/courses';
import { API_BASE_URL } from '@/app/components/utils/api_url';
import { getRequestContext, getSyear } from '../../page';

const PRESENTATION_SLIDE_OPTIONS = ['8 slides', '10 slides', '12 slides', '15 slides', '18 slides'] as const;
const GAMMA_THEME_OPTIONS = ['EduERP default', 'Clean light', 'Bold classroom', 'Scholar blue'] as const;

interface GeneratePresentationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  allChapters: Chapter[];
  courseId: string;
  initialChapterId?: string;
  initialConcept?: string;
  course?: Pick<Course, 'subject' | 'classGrade'>;
  onSuccess?: (data: Record<string, unknown>) => void;
}

export function GeneratePresentationDrawer({
  isOpen,
  onClose,
  allChapters,
  courseId,
  initialChapterId = '',
  initialConcept = '',
  course,
  onSuccess,
}: GeneratePresentationDrawerProps) {
  const [presentationMode, setPresentationMode] = useState<'Classroom' | 'Teacher training'>('Classroom');
  const [presentationChapterId, setPresentationChapterId] = useState(initialChapterId);
  const [presentationConcept, setPresentationConcept] = useState(initialConcept);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationSuccess, setGenerationSuccess] = useState<string | null>(null);
  const [selectedSlideCount, setSelectedSlideCount] = useState(10);

  const exportFormat = 'pdf';

  // Get concept options for the selected chapter from API-loaded chapter data
  const presentationConceptOptions = useMemo(() => {
    if (!presentationChapterId || !allChapters.length) return [];
    const chapter = allChapters.find((ch) => ch.id === presentationChapterId);
    const concepts = chapter?.concepts ?? [];
    return concepts.map((concept) => ({
      id: concept.id,
      title: concept.title,
    }));
  }, [presentationChapterId, allChapters]);

  // Update concept selection when chapter changes in teacher training mode
  useEffect(() => {
    if (!presentationChapterId || presentationMode !== 'Teacher training') return;
    
    const chapter = allChapters.find((ch) => ch.id === presentationChapterId);
    const concepts = chapter?.concepts ?? [];
    const currentConceptExists = concepts.some((concept) => concept.id === presentationConcept);
    
    if (!currentConceptExists && concepts.length > 0) {
      setPresentationConcept(concepts[0].id);
    } else if (concepts.length === 0) {
      setPresentationConcept('');
    }
  }, [presentationChapterId, presentationMode, allChapters, presentationConcept]);

  // Reset form when drawer opens
  useEffect(() => {
    if (isOpen) {
      setPresentationChapterId(initialChapterId);
      setPresentationConcept(initialConcept);
      setGenerationError(null);
      setGenerationSuccess(null);
      setIsGenerating(false);
    }
  }, [isOpen, initialChapterId, initialConcept]);

  const extractText = (arr: unknown[] | undefined, key: string): string => {
    if (!Array.isArray(arr) || arr.length === 0) return 'Not specified';
    return arr.map((a) => (a as Record<string, unknown>)?.[key]).filter(Boolean).join('; ');
  };

  const constructPrompt = (chapter: Chapter): string => {
    const standard = course?.classGrade || 'Standard';
    const subject = course?.subject || 'Subject';
    const chapterName = chapter.title || 'Chapter';

    const semantic = chapter.semantic?.full_intelegance_json;
    const entries = semantic?.concepts ? (semantic.concepts as Record<string, unknown>[]) : [];

    let conceptsYaml = '';
    if (entries.length > 0) {
      for (const entry of entries) {
        const conceptName = (entry as Record<string, unknown>)?.concept
          ? ((entry as Record<string, unknown>).concept as Record<string, unknown>)?.concept_name || 'Concept'
          : 'Concept';
        const knowledge = extractText((entry as Record<string, unknown>)?.knowledge_items as unknown[] | undefined, 'knowledge');
        const ability = extractText((entry as Record<string, unknown>)?.abilities as unknown[] | undefined, 'ability');
        const skill = extractText((entry as Record<string, unknown>)?.skills as unknown[] | undefined, 'skill');
        const competency = extractText((entry as Record<string, unknown>)?.competencies as unknown[] | undefined, 'competency');
        const blooms = extractText((entry as Record<string, unknown>)?.blooms as unknown[] | undefined, 'level');
        const dok = extractText((entry as Record<string, unknown>)?.dok as unknown[] | undefined, 'level');
        const pedagogy = extractText((entry as Record<string, unknown>)?.pedagogy_recommendations as unknown[] | undefined, 'strategy');
        const rwa = extractText((entry as Record<string, unknown>)?.real_world_applications as unknown[] | undefined, 'application');
        const misconceptions = extractText((entry as Record<string, unknown>)?.misconceptions as unknown[] | undefined, 'misconception');
        const objectives = extractText((entry as Record<string, unknown>)?.learning_objectives as unknown[] | undefined, 'objective');
        const outcomes = extractText((entry as Record<string, unknown>)?.learning_outcomes as unknown[] | undefined, 'outcome');
        const prerequisites = extractText((entry as Record<string, unknown>)?.prerequisites as unknown[] | undefined, 'concept_name');

        conceptsYaml += `  - Concept: ${conceptName}
    Knowledge: ${knowledge}
    Ability: ${ability}
    Skill: ${skill}
    Competency: ${competency}
    BloomLevel: ${blooms}
    DOKLevel: ${dok}
    SuggestedPedagogy: ${pedagogy}
    RealTimeApplications: ${rwa}
    CommonMisconceptions: ${misconceptions}
    LearningObjectives: ${objectives}
    LearningOutcomes: ${outcomes}
    Prerequisites: ${prerequisites}

`;
      }
    }

    return `You are an expert instructional designer, curriculum architect, competency-based education specialist, and classroom presentation generator aligned with NCERT, NEP 2020, NCF, NCTE, and NPST principles.
Objective
Generate a complete classroom presentation for an entire chapter.
The presentation must help learners progressively develop Knowledge, Ability, Skill, Competency, Concept Mastery, and Chapter Mastery while achieving the specified Learning Objectives and Learning Outcomes.

Inputs
Standard: ${standard}
Subject: ${subject}
Chapter: ${chapterName}
ChapterConcepts:
${conceptsYaml}

Chapter Intelligence Synthesis
Before generating slides, determine:
Chapter Big Idea
Concept Clusters
Chapter Competencies
Chapter Learning Objectives
Chapter Learning Outcomes
Bloom Progression
DOK Progression

Presentation Generation Rules
Concept-Driven Chapter Design
Cover all available concepts
Build conceptual progression
Prevent fragmented learning
Avoid concept isolation, content dumping, and textbook summarization

Slide Planning Logic
Determine the most effective slide sequence based on:
number of concepts
concept complexity
competency complexity
Bloom levels
DOK levels
Recommended range:
5-10 slides per concept cluster
20-60 slides per chapter

Output Requirements
For every slide generate:
Slide Number
Slide Title
Concept Coverage
Concept Intelligence Mapping
Knowledge:
Ability:
Skill:
Competency:
BloomLevel:
DOKLevel:
Purpose
Content
Speaker Notes
Student Interaction
Assessment Opportunity
Image Prompt

Quality Requirements
The presentation must:
be chapter-focused through concept mastery
cover every major concept
show concept interconnections
be classroom-ready
be age-appropriate
be competency-oriented
align with Bloom and DOK progressions
use pedagogy dynamically
integrate real-world applications
explicitly address misconceptions
encourage critical thinking
promote active participation
support measurable learning outcomes
enable observable competency demonstrations
culminate in chapter-level mastery
Generate the complete presentation in a professional classroom presentation format.

Ground Truth Chapter Content (No Hallucinations)
Below is the exact, raw textbook content for this chapter. 
CRITICAL INSTRUCTION: You MUST use the exact definitions, examples, and terminology found in this text when generating the slide content. 

${semantic?.chapter_summary || chapter.title || 'Content not available.'}`;
  };

  const constructTeacherTrainingPrompt = (chapter: Chapter, conceptId: string): string => {
    const standard = course?.classGrade || 'Standard';
    const subject = course?.subject || 'Subject';
    const chapterName = chapter.title || 'Chapter';

    const semantic = chapter.semantic?.full_intelegance_json;
    const conceptTitle = chapter.concepts?.find((c) => c.id === conceptId)?.title ?? 'Concept';
    const entries = semantic?.concepts ? (semantic.concepts as Record<string, unknown>[]) : [];
    const conceptEntry = entries.find((entry) => {
      const entryConceptName = (entry as Record<string, unknown>)?.concept
        ? ((entry as Record<string, unknown>).concept as Record<string, unknown>)?.concept_name
        : '';
      return entryConceptName === conceptTitle;
    });

    const conceptName = conceptTitle;
    const knowledge = extractText((conceptEntry as Record<string, unknown>)?.knowledge_items as unknown[] | undefined, 'knowledge');
    const ability = extractText((conceptEntry as Record<string, unknown>)?.abilities as unknown[] | undefined, 'ability');
    const skill = extractText((conceptEntry as Record<string, unknown>)?.skills as unknown[] | undefined, 'skill');
    const competency = extractText((conceptEntry as Record<string, unknown>)?.competencies as unknown[] | undefined, 'competency');
    const blooms = extractText((conceptEntry as Record<string, unknown>)?.blooms as unknown[] | undefined, 'level');
    const dok = extractText((conceptEntry as Record<string, unknown>)?.dok as unknown[] | undefined, 'level');
    const pedagogy = extractText((conceptEntry as Record<string, unknown>)?.pedagogy_recommendations as unknown[] | undefined, 'strategy');
    const rwa = extractText((conceptEntry as Record<string, unknown>)?.real_world_applications as unknown[] | undefined, 'application');
    const misconceptions = extractText((conceptEntry as Record<string, unknown>)?.misconceptions as unknown[] | undefined, 'misconception');
    const objectives = extractText((conceptEntry as Record<string, unknown>)?.learning_objectives as unknown[] | undefined, 'objective');
    const outcomes = extractText((conceptEntry as Record<string, unknown>)?.learning_outcomes as unknown[] | undefined, 'outcome');
    const prerequisites = extractText((conceptEntry as Record<string, unknown>)?.prerequisites as unknown[] | undefined, 'concept_name');

    return `Teacher Training PPT — Master Prompt Template (Single-Concept, Suggested-Pedagogy Oriented + Differentiated Instruction)

Concept Data Block (fill once)
Concept: ${conceptName}
Knowledge: ${knowledge}
Ability: ${ability}
Skill: ${skill}
Competency: ${competency}
Bloom's Level: ${blooms}
Depth of Knowledge (DOK): ${dok}
Suggested Pedagogy: ${pedagogy}
Real-Time Application: ${rwa}
Common Misconceptions: ${misconceptions}
Learning Objectives: ${objectives}
Learning Outcomes: ${outcomes}
Prerequisites: ${prerequisites}

Slide-by-Slide Prompt
Slide 1: Title Slide
 Title: Teacher Training through ${pedagogy} Pedagogy-Oriented Learning Design for ${conceptName} (${standard}, ${subject}, ${chapterName})
 Sub-title: Aligned with NCERT, NEP 2020, NCTE, NPST | Concept-Specific Pedagogy & Differentiated Instruction
 Image Prompt: A diverse group of students engaged in an activity matching ${pedagogy}. Warm natural lighting, modern classroom. Minimalist, no text.
Slide 2: Objectives of the Session
 Content: Understand ${conceptName} and why ${pedagogy} fits it; apply the pedagogy in practice; differentiate by readiness & cognitive demand
 Image Prompt: 3D wooden clipboard with three icons — puzzle piece (pedagogy-fit), gears (application), checklist (differentiation). Pastel background, no text.
Slide 3: Why Pedagogy Must Match This Concept
 Content: One-size-fits-all teaching vs. ${pedagogy} matched specifically to ${conceptName}'s nature and cognitive demand
 Image Prompt: Split-screen: a classroom with identical worksheets vs. a classroom set up for ${pedagogy}. No labels, muted colors.
Slide 4: NEP 2020 & NPST Emphasis
 Content: Active, Inquiry, Competency-aligned pedagogy choice — as reflected in the choice of ${pedagogy} for ${conceptName}
 Image Prompt: Minimalist desk, open NEP 2020 document, magnifying glass over "Active Learning," "Competency." Soft blue background.
Slide 5: Concept Snapshot — ${conceptName}
 Content: Definition/scope of ${conceptName} within ${chapterName}; its ${blooms} and ${dok} placement; why ${pedagogy} was selected
 Image Prompt: A single concept node with branching labels for Bloom's Level, DOK, and pedagogy icon. Clean, no text.
Slide 6: Prerequisites Check — ${conceptName}
 Content: ${prerequisites} — diagnostic entry point before beginning the pedagogy-based activity
 Image Prompt: Teacher with a checklist beside a foundation/building-blocks metaphor. No text.
Slide 7: ${conceptName} — ${pedagogy} in Practice
 Content: Step-by-step on how to run ${pedagogy} for this concept; Bloom's Level: ${blooms}, DOK: ${dok}; targets ${knowledge}/${ability}/${skill}/${competency}
 Image Prompt: Visual matched specifically to ${pedagogy} Warm, no text.
Slide 8: ${conceptName} — Application & Misconceptions
 Content: Real-Time Application: ${rwa}; Common Misconceptions: ${misconceptions} and how ${pedagogy} surfaces/corrects them
 Image Prompt: A magnifying glass over a tangled-to-untangled thread (misconception correction), paired with a real-world scene matching ${rwa}. No text.
Slide 9: Differentiating Within ${pedagogy}


 Content: How ${pedagogy} for ${conceptName} can be tiered by readiness (Content), grouped by role (Process), and assessed at different levels (Product) — using Knowledge/Ability/Skill/Competency layers
 Image Prompt: One pedagogy icon shown with three branching tiers of varying complexity. Abstract, no text.
Slide 10: Role of the Teacher in ${pedagogy}


Content: The facilitator role for this specific pedagogy: ${pedagogy}
 Image Prompt: Teacher shown in a vignette taking on the relevant supporting role. Natural light, no text.
Slide 11: Differentiated Assessment Design — ${conceptName}
 
Content: Assessment format matched to ${pedagogy} and ${competency} layer; tiered by ${dok}
 Image Prompt: A rubric checklist with multiple tiered rating columns, pedagogy icon beside each row. Pastel background, no text.
Slide 12: Sample Lesson Plan — ${conceptName}


 Content: Full lesson plan for ${conceptName}, built from ${objectives} and ${outcomes}, structured around ${pedagogy}
 Image Prompt: A lesson-plan page with pedagogy-specific icons along the margin. Monochrome with one accent color.
Slide 13: Digital Tools for ${pedagogy}


 Content: Canva, Padlet, Google Docs, Jamboard — which tool(s) best support ${pedagogy} specifically, and how
 Image Prompt: Students collaborating on laptops/tablets with generic UI, small pedagogy-icon label. Tech-abstract style.
Slide 14: Overcoming Challenges


Content: Time, materials/prep needed for ${pedagogy}, mixed-readiness classroom considerations for ${conceptName}
 Image Prompt: Teacher's hands over a complex timetable, clock in background. Muted tones.
Slide 15: Teacher Reflection Framework


Content: What worked, what didn't — specific to using ${pedagogy} for ${conceptName}
 Image Prompt: Teacher at desk with checklist, thought bubbles. No text.
Slide 16: Action Plan


Content: Steps to implement ${pedagogy} for ${conceptName} in the classroom, reflect, and refine before next use
 Image Prompt: Wooden staircase with abstract steps, each bearing a faint pedagogy icon. No text.
Slide 17: Activity — Design a Lesson for ${conceptName}


 Content: Teachers draft a lesson for ${conceptName} using ${pedagogy}, differentiated by readiness
 Image Prompt: Blank lesson plan template with colorful pens, sticky notes, a small pedagogy icon in the corner. Inviting, empty.
Slide 18: Feedback, Q&A, Thank You


Content: Collect participant responses on how ${pedagogy} worked for ${conceptName}
 Image Prompt: Bright empty classroom, "Thank You" on chalkboard, sunlight streaming in.
 
Ground Truth Chapter Content (No Hallucinations)
Below is the exact, raw textbook content for this chapter. 
CRITICAL INSTRUCTION: You MUST use the exact definitions, examples, and terminology found in this text when generating the slide content. Do not invent outside examples unless explicitly requested by the pedagogy. 
CRITICAL INSTRUCTION 2: Ensure all generated slide content is highly detailed, comprehensive, and perfectly explained. Do not use short or superficial bullet points. Provide deep, clear, and perfectly articulated explanations suitable for a professional presentation.

${semantic?.chapter_summary || chapter.title || 'Content not available.'}`;
  };

  const handleGenerate = async () => {
    if (!presentationChapterId) return;

    setGenerationError(null);
    setIsGenerating(true);

    try {
      const chapter = allChapters.find((ch) => ch.id === presentationChapterId);
      if (!chapter) {
        setGenerationError('Please select a valid chapter.');
        setIsGenerating(false);
        return;
      }

      if (presentationMode === 'Teacher training' && !presentationConcept) {
        setGenerationError('Please select a concept for teacher training.');
        setIsGenerating(false);
        return;
      }

      const prompt = presentationMode === 'Teacher training'
        ? constructTeacherTrainingPrompt(chapter, presentationConcept)
        : constructPrompt(chapter);
      const requestContext = getRequestContext();
      let sub_institute_id = 0;
      let user_id = 0;
      let user_profile_name = '';
      try {
        const userData = JSON.parse(localStorage.getItem('userData') || '{}') as Record<string, unknown>;
        const menuContext = JSON.parse(localStorage.getItem('menuContext') || '{}') as Record<string, unknown>;
        sub_institute_id = Number(userData.sub_institute_id ?? menuContext.sub_institute_id ?? requestContext?.sub_institute_id ?? 0);
        user_id = Number(requestContext?.user_id ?? userData.user_id ?? menuContext.user_id ?? 0);
        user_profile_name = String(requestContext?.user_profile_name ?? userData.user_profile_name ?? menuContext.user_profile_name ?? '');
      } catch {}

      const res = await fetch(`${API_BASE_URL}/lms/gamma_content_master/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'API',
          sub_institute_id,
          syear: getSyear(),
          user_id,
          user_profile_name,
          chapter_name: chapter.title,
          prompt,
          format: 'presentation',
          export_format: exportFormat,
          slide_count: selectedSlideCount,
        }),
      });

      const raw = (await res.json()) as Record<string, unknown>;
      if (!res.ok || Number(raw.status_code) !== 1) {
        throw new Error((raw.message as string) || 'Failed to generate presentation');
      }

      onSuccess?.(raw);
      setGenerationSuccess((raw.message as string) || 'Gamma content generated and stored successfully');
      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 2000);
    } catch (err) {
      console.error(err);
      setGenerationError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 transition-all duration-300',
        isOpen ? 'pointer-events-auto' : 'pointer-events-none'
      )}
    >
      <div
        className={cn(
          'absolute inset-0 bg-slate-950/45 transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'opacity-0'
        )}
        onClick={onClose}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="generate-presentation-title"
        className={cn(
          'absolute right-0 top-0 flex h-full w-full max-w-[700px] flex-col overflow-hidden rounded-l-[28px] border-l border-slate-200/80 bg-white shadow-[-24px_0_70px_rgba(15,23,42,0.18)] transition-transform duration-300',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 px-5 py-5 sm:px-6">
          <div>
            <h2 id="generate-presentation-title" className="text-[18px] font-bold tracking-tight text-slate-950 sm:text-[20px]">
              Generate presentation
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close drawer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-4 text-slate-600 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#4f46e5] ring-1 ring-slate-200/80">
                <Sparkles size={16} />
              </div>
              <p className="text-[15px] leading-7">
                Slides are drafted with <span className="font-semibold text-slate-900">Gamma</span> from concept intelligence, then added to your content library.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-slate-100/90 p-1">
            <div className="grid grid-cols-2 gap-1">
              {(['Classroom', 'Teacher training'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPresentationMode(mode)}
                  className={cn(
                    'rounded-xl px-4 py-3 text-left text-[15px] font-semibold transition-colors',
                    presentationMode === mode
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {presentationMode === 'Classroom' ? (
            // Classroom tab - only chapter selection
            <div className="mt-6">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Chapter <span className="text-rose-500">*</span>
                </Label>
                <Select 
                  value={presentationChapterId} 
                  onValueChange={(value) => setPresentationChapterId(value ?? '')}
                >
                  <SelectTrigger className="h-12 rounded-xl border-slate-300 px-4 text-[15px] text-slate-900 shadow-none">
                    <SelectValue placeholder="Select chapter">
                      {allChapters.find(ch => ch.id === presentationChapterId)?.title || 'Select chapter'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {allChapters.map((chapter) => (
                      <SelectItem key={chapter.id} value={chapter.id}>
                        {chapter.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            // Teacher training tab - chapter and concept selection
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Chapter <span className="text-rose-500">*</span>
                </Label>
                <Select 
                  value={presentationChapterId} 
                  onValueChange={(value) => setPresentationChapterId(value ?? '')}
                >
                  <SelectTrigger className="h-12 rounded-xl border-slate-300 px-4 text-[15px] text-slate-900 shadow-none">
                    <SelectValue placeholder="Select chapter">
                      {allChapters.find(ch => ch.id === presentationChapterId)?.title || 'Select chapter'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {allChapters.map((chapter) => (
                      <SelectItem key={chapter.id} value={chapter.id}>
                        {chapter.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Concept <span className="text-rose-500">*</span>
                </Label>
                <Select 
                  value={presentationConcept} 
                  onValueChange={(value) => setPresentationConcept(value ?? '')}
                >
                   <SelectTrigger className="h-12 rounded-xl border-slate-300 px-4 text-[15px] text-slate-900 shadow-none">
                     <SelectValue placeholder="Select concept">
                       {presentationConceptOptions.find((c) => c.id === presentationConcept)?.title || 'Select concept'}
                     </SelectValue>
                   </SelectTrigger>
                  <SelectContent>
                    {presentationConceptOptions.length > 0 ? (
                      presentationConceptOptions.map((concept) => (
                        <SelectItem key={concept.id} value={concept.id}>
                          {concept.title}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="" disabled>No concepts available</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          {generationError && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {generationError}
            </div>
          )}
          {generationSuccess && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {generationSuccess}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-4 border-t border-slate-200/80 px-5 py-5 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="text-[15px] font-medium text-slate-600 transition-colors hover:text-slate-900"
          >
            Cancel
          </button>
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || !presentationChapterId}
            className="h-12 rounded-2xl bg-[#4f46e5] px-6 text-[15px] font-semibold text-white shadow-[0_10px_24px_rgba(79,70,229,0.28)] hover:bg-[#4338ca] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles size={16} className="mr-2" />
                Generate with Gamma
              </>
            )}
          </Button>
        </div>
      </aside>
    </div>
  );
}