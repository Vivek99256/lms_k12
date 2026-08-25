'use client';

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
import { fetchSemanticIntelligenceResult } from '../../data/chapters';
import type { Chapter, SemanticIntelligenceResult } from '../../data/chapters';
import type { Course } from '../../data/courses';
import { API_BASE_URL } from '@/app/components/utils/api_url';
import { getRequestContext, getSyear } from '../../page';

const DEFAULT_SLIDE_COUNT = 30;
const GAMMA_GENERATION_TIMEOUT_MS = 10 * 60 * 1000;
const CONTENT_TYPE_OPTIONS = [
  { label: 'Presentation', value: 'Presentation', apiValue: 'presentation' },
  { label: 'Revision Notes', value: 'Revision Notes', apiValue: 'Revision Notes' },
  { label: 'Classroom Activity', value: 'Classroom Activity', apiValue: 'Classroom Activity' },
  { label: 'Remedial Class', value: 'Remedial Class', apiValue: 'remedial_class' },
] as const;
// Mirrors UPLOAD_PRESENTATION_TYPES in the chapters page: the library reads this
// string out of content_category to decide the Teacher Resource lane.
const TEACHER_TRAINING_CONTENT_CATEGORY = 'Teacher training presentation';
const PDF_FORMATTING_INSTRUCTIONS = `PDF formatting instructions:
- Generate the final answer as clean HTML suitable for direct PDF conversion.
- Use semantic HTML tags such as <h2>, <h3>, <p>, <strong>, <ul>, <ol>, <li>, and <table> where appropriate.
- Do not use Markdown syntax such as #, ##, **, *, backticks, or code fences in the final answer.
- Use clear section headings, bold emphasis, readable lists, adequate spacing, and a professional document layout.
- Return only the document body content, without wrapping it in markdown fences.`;

function readErrorMessage(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object') return '';

  const record = value as Record<string, unknown>;
  const errors = record.errors;
  if (errors && typeof errors === 'object') {
    for (const errorValue of Object.values(errors as Record<string, unknown>)) {
      if (Array.isArray(errorValue)) {
        const firstMessage = errorValue.map(readErrorMessage).find(Boolean);
        if (firstMessage) return firstMessage;
      } else {
        const message = readErrorMessage(errorValue);
        if (message) return message;
      }
    }
  }

  const nestedError = readErrorMessage(record.error);
  if (nestedError) return nestedError;

  const directMessage = readErrorMessage(record.message);
  if (directMessage) return directMessage;

  return '';
}

/**
 * "<board> Standard <grade>" for the generation prompt. The board comes from the
 * tenant's curriculum record when known, otherwise from a board prefix on the
 * grade itself; with neither available the board is left out rather than guessed.
 */
function getBoardStandardLabel(classGrade?: string, board?: string) {
  const rawGrade = (classGrade || '').replace(/^Class\s+/i, '').trim();
  const boardMatch = rawGrade.match(/^([A-Za-z]+)[-\s]+(.+)$/);

  const resolvedBoard = (board || '').trim() || (boardMatch ? boardMatch[1].toUpperCase() : '');
  const grade = (boardMatch ? boardMatch[2].trim() : rawGrade) || 'Standard';

  return resolvedBoard ? `${resolvedBoard} Standard ${grade}` : `Standard ${grade}`;
}

interface GeneratePresentationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  allChapters: Chapter[];
  courseId: string;
  initialChapterId?: string;
  initialConcept?: string;
  course?: Pick<Course, 'subject' | 'classGrade'>;
  /** Board of the tenant's curriculum (CBSE / ICSE / IB / …), used in the prompt. */
  board?: string;
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
  board,
  onSuccess,
}: GeneratePresentationDrawerProps) {
  const [presentationMode, setPresentationMode] = useState<'Classroom' | 'Teacher training'>('Classroom');
  const [contentType, setContentType] = useState('Presentation');
  const [teacherContentType, setTeacherContentType] = useState('Teacher Presentation');
  const [presentationChapterId, setPresentationChapterId] = useState(initialChapterId);
  const [presentationConcept, setPresentationConcept] = useState(initialConcept);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationSuccess, setGenerationSuccess] = useState<string | null>(null);

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
    const nextConcept = !currentConceptExists && concepts.length > 0
      ? concepts[0].id
      : concepts.length === 0
        ? ''
        : null;
    
    if (nextConcept === null) return;

    const timeoutId = window.setTimeout(() => setPresentationConcept(nextConcept), 0);
    return () => window.clearTimeout(timeoutId);
  }, [presentationChapterId, presentationMode, allChapters, presentationConcept]);

  // Reset form when drawer opens
  useEffect(() => {
    if (!isOpen) return;

    const timeoutId = window.setTimeout(() => {
      setPresentationChapterId(initialChapterId);
      setPresentationConcept(initialConcept);
      setGenerationError(null);
      setGenerationSuccess(null);
      setIsGenerating(false);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isOpen, initialChapterId, initialConcept]);

  const extractText = (arr: unknown[] | undefined, key: string): string => {
    if (!Array.isArray(arr) || arr.length === 0) return 'Not specified';
    const text = arr.map((a) => (a as Record<string, unknown>)?.[key]).filter(Boolean).join('; ');
    return text || 'Not specified';
  };

  const extractAnyText = (arr: unknown[] | undefined, keys: string[]): string => {
    if (!Array.isArray(arr) || arr.length === 0) return 'Not specified';
    for (const key of keys) {
      const text = arr.map((a) => (a as Record<string, unknown>)?.[key]).filter(Boolean).join('; ');
      if (text) return text;
    }
    return 'Not specified';
  };

  const getSemanticPayload = (chapter: Chapter, result?: SemanticIntelligenceResult | null) => {
    const raw = result?.full_intelligence_json ?? result?.full_intelegance_json ?? chapter.semantic?.full_intelligence_json ?? chapter.semantic?.full_intelegance_json;
    const intelligence = raw && typeof raw === 'object' && 'intelligence' in raw
      ? (raw as Record<string, unknown>).intelligence as Record<string, unknown>
      : raw;

    return {
      intelligence: (intelligence ?? {}) as Record<string, unknown>,
      mdContent: result?.md_content ?? chapter.semantic?.md_content ?? '',
    };
  };

  const getConceptEntries = (semantic: Record<string, unknown>) => {
    const list = semantic.concepts ?? semantic.topics ?? semantic.teaching_units;
    return Array.isArray(list) ? (list as Record<string, unknown>[]) : [];
  };

  const getEntryConceptName = (entry: Record<string, unknown>) => {
    const concept = entry.concept as Record<string, unknown> | undefined;
    return String(concept?.concept_name ?? entry.topic_title ?? entry.topic_name ?? 'Concept');
  };

  const constructPrompt = (chapter: Chapter, semanticResult?: SemanticIntelligenceResult | null): string => {
    const standard = course?.classGrade || 'Standard';
    const subject = course?.subject || 'Subject';
    const chapterName = chapter.title || 'Chapter';

    const semanticPayload = getSemanticPayload(chapter, semanticResult);
    const entries = getConceptEntries(semanticPayload.intelligence);

    let conceptsYaml = '';
    if (entries.length > 0) {
      for (const entry of entries) {
        const conceptName = getEntryConceptName(entry);
        const knowledge = extractText((entry as Record<string, unknown>)?.knowledge_items as unknown[] | undefined, 'knowledge');
        const ability = extractText((entry as Record<string, unknown>)?.abilities as unknown[] | undefined, 'ability');
        const skill = extractText((entry as Record<string, unknown>)?.skills as unknown[] | undefined, 'skill');
        const competency = extractText((entry as Record<string, unknown>)?.competencies as unknown[] | undefined, 'competency');
        const blooms = extractText((entry as Record<string, unknown>)?.blooms as unknown[] | undefined, 'level');
        const dok = extractText((entry as Record<string, unknown>)?.dok as unknown[] | undefined, 'level');
        const pedagogy = extractText((entry as Record<string, unknown>)?.pedagogy_recommendations as unknown[] | undefined, 'strategy');
        const rwa = extractAnyText((entry as Record<string, unknown>)?.real_world_applications as unknown[] | undefined, ['example', 'application']);
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

Generation Compliance Contract
You must follow the prompt requirements exactly. Do not add unrelated pedagogical theory, generic instructional strategy explanations, or extra content sections unless they directly satisfy one of the required slide fields below.
Every major concept must have visible competency mapping, assessment design, classroom interaction, and image guidance.
Every slide must be usable by a teacher without additional interpretation.
If a required data item is "Not specified", write a brief classroom-appropriate placeholder based only on the Ground Truth Chapter Content and clearly keep it within the chapter scope.

Output Requirements
For every slide, generate exactly these sections in this order:
Slide Number
Slide Title
Concept Coverage: list the concept or concept cluster addressed.
Concept Intelligence Mapping:
Knowledge:
Ability:
Skill:
Competency:
BloomLevel:
DOKLevel:
Purpose: explain why this slide is needed in the learning progression.
Content: detailed classroom-ready explanation using the Ground Truth Chapter Content.
Speaker Notes: facilitation guidance for the teacher.
Student Interaction: include a question, discussion, investigation, reflection, pair task, or class activity.
Assessment Design: include assessment type, observable evidence, success criteria, and one quick teacher check.
Lesson Planning Link: include timing, materials/preparation, grouping, and transition to the next slide or activity.
Digital Tool Integration: include a relevant tool or "No digital tool required" with a reason.
Image Prompt: provide one detailed visual prompt with age-appropriate style, realistic classroom or contextual scene, no readable text, no labels, no UI screenshots, no decorative abstract-only image.

Final Slide Audit
At the end of the response, include a "Compliance Audit" with:
All concepts covered: Yes/No
Competency mapping present on every slide: Yes/No
Assessment design present on every slide: Yes/No
Lesson planning details present on every slide: Yes/No
Digital tool guidance present where useful: Yes/No
Image prompt present on every slide: Yes/No
No extra unrelated content added: Yes/No

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

${semanticPayload.mdContent || String(semanticPayload.intelligence.chapter_summary ?? chapter.title ?? 'Content not available.')}`;
  };

  const constructTeacherTrainingPrompt = (chapter: Chapter, conceptId: string, semanticResult?: SemanticIntelligenceResult | null): string => {
    const standard = course?.classGrade || 'Standard';
    const subject = course?.subject || 'Subject';
    const chapterName = chapter.title || 'Chapter';

    const semanticPayload = getSemanticPayload(chapter, semanticResult);
    const conceptTitle = chapter.concepts?.find((c) => c.id === conceptId)?.title ?? 'Concept';
    const entries = getConceptEntries(semanticPayload.intelligence);
    const conceptEntry = entries.find((entry) => {
      const entryConceptName = getEntryConceptName(entry);
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
    const rwa = extractAnyText((conceptEntry as Record<string, unknown>)?.real_world_applications as unknown[] | undefined, ['example', 'application']);
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
Follow exactly the 18-slide structure below.Do not add extra slides, extra frameworks, or generic pedagogy explanations unless they are directly i nside the named slide's required content.

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

${semanticPayload.mdContent || String(semanticPayload.intelligence.chapter_summary ?? chapter.title ?? 'Content not available.')}`;
  };

  const constructDocumentPrompt = (chapter: Chapter, selectedContentType: string, semanticResult?: SemanticIntelligenceResult | null): string => {
    const standard = course?.classGrade || 'Standard';
    const subject = course?.subject || 'Subject';
    const chapterName = chapter.title || 'Chapter';
    const semanticPayload = getSemanticPayload(chapter, semanticResult);
    const groundTruthContent = semanticPayload.mdContent || String(semanticPayload.intelligence.chapter_summary ?? chapter.title ?? 'Content not available.');

    // The board comes from the tenant's curriculum; with none configured the prompt
    // names the national frameworks only rather than assuming a board.
    const boardExpertise = board?.trim() ? `${board.trim()}, NCERT` : 'NCERT';

    if (selectedContentType.trim().toLowerCase() === 'remedial class') {
      return `You are an AI-powered Remedial Education Specialist, Instructional Designer, and Inclusive Education Expert specializing in ${boardExpertise}, NEP 2020, NCF, Competency-Based Education (CBE), and Inquiry-Based Learning (IBL).

Analyze the attached chapter PDF and generate a comprehensive Chapter-wise Remedial Class for ${getBoardStandardLabel(standard, board)}, Subject ${subject}, Chapter "${chapterName}".

The remedial content should support slow learners, below-average performers, students with learning gaps, and students requiring additional reinforcement after the regular classroom teaching.

The remedial class should not repeat the classroom lesson. Instead, it should identify learning gaps, simplify difficult concepts, provide alternative teaching strategies, and build confidence through interactive and activity-based learning.

${PDF_FORMATTING_INSTRUCTIONS}

Attached Chapter PDF / Ground Truth Chapter Content:
${groundTruthContent}`;
    }

    if (selectedContentType.trim().toLowerCase() === 'classroom activity') {
      return `Generate Presentation with an attached chapter PDF to a classroom activity using Inquiry-based learning on ${chapterName} for ${getBoardStandardLabel(course?.classGrade, board)} ${subject}. The Inquiry-based learning should include interactive elements such as role-playing, quizzes, puzzles, or simulations tailored to best practices. It must align with the chapter's learning objectives, focus on student engagement, and enhance knowledge retention & application of knowledge.

Incorporate the following elements:
- Clear activity instructions for the teacher.
- Materials/resources required for the activity.
- Steps to implement the activity in the classroom.
- Assessment criteria to measure learning outcomes.

${PDF_FORMATTING_INSTRUCTIONS}

Attached Chapter PDF / Ground Truth Chapter Content:
${groundTruthContent}`;
    }

    const entries = getConceptEntries(semanticPayload.intelligence);
    const keyConcepts = entries.length > 0
      ? entries.map(getEntryConceptName).filter(Boolean).join(', ')
      : (chapter.concepts ?? []).map((concept) => concept.title).filter(Boolean).join(', ') || 'all key concepts from the chapter';

    const isRevisionNotes = selectedContentType.trim().toLowerCase() === 'revision notes';
    const contentTypePhrase = isRevisionNotes ? 'a comprehensive set of revision notes' : `${selectedContentType} content`;
    const coveragePhrase = isRevisionNotes ? 'The revision notes should cover' : 'The content should cover';

    return `Generate ${contentTypePhrase} as per the attached PDF for ${standard} ${subject} students. ${coveragePhrase} the Chapter: ${chapterName}, with a focus on the following key concepts: ${keyConcepts}. Structure the content clearly with headings and subheadings for easy understanding, write it for students engaging in Inquiry-based teaching, and include short descriptions, diagrams where applicable, bullet points, and key takeaways.

${PDF_FORMATTING_INSTRUCTIONS}

Attached PDF / Ground Truth Chapter Content:
${groundTruthContent}`;
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

      const normalizedContentType = contentType.trim().toLowerCase();
      // The Teacher Resource tab always produces a deck, whatever the Classroom
      // tab's content type happens to be left on.
      const isTeacherTraining = presentationMode === 'Teacher training';
      const isPresentation = isTeacherTraining || normalizedContentType === 'presentation';
      const exportFormat = isPresentation ? 'pptx' : 'pdf';
      // content_category is what splits the library into Classroom Resource vs
      // Teacher Resource, so teacher-training decks must be filed under their own
      // category instead of the generic 'presentation'.
      const apiContentType = isTeacherTraining
        ? TEACHER_TRAINING_CONTENT_CATEGORY
        : CONTENT_TYPE_OPTIONS.find((option) => option.value === contentType)?.apiValue ?? contentType;

      if (isTeacherTraining && !presentationConcept) {
        setGenerationError('Please select a concept for teacher training.');
        setIsGenerating(false);
        return;
      }

      let semanticResult: SemanticIntelligenceResult | null = null;
      try {
        semanticResult = await fetchSemanticIntelligenceResult(chapter.id);
      } catch (error) {
        console.warn('[GeneratePresentation] Falling back to chapter semantic data:', error);
      }
      const prompt = isPresentation
        ? isTeacherTraining
          ? constructTeacherTrainingPrompt(chapter, presentationConcept, semanticResult)
          : constructPrompt(chapter, semanticResult)
        : constructDocumentPrompt(chapter, contentType, semanticResult);

      console.log(`[GeneratePresentation] ${contentType} prompt:`, prompt);

      console.log('[GeneratePresentation] Data used to generate content:', {
        presentationMode,
        courseId,
        course,
        chapter: {
          id: chapter.id,
          title: chapter.title,
          semanticResultId: semanticResult?.id,
          semanticExtractionId: semanticResult?.extraction_id,
          hasGroundTruthContent: Boolean(semanticResult?.md_content),
        },
        presentationChapterId,
        presentationConcept,
        exportFormat,
        slideCount: DEFAULT_SLIDE_COUNT,
        contentType,
        apiContentType,
        prompt,
      });

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

      const payload = {
        type: 'API',
        sub_institute_id,
        syear: getSyear(),
        user_id,
        user_profile_name,
        chapter_name: chapter.title,
        // The deck is generated for one concept; sending it lets the stored row
        // carry the concept mapping instead of only the chapter.
        concept_id: presentationConcept || undefined,
        concept_name:
          presentationConceptOptions.find((c) => c.id === presentationConcept)?.title || undefined,
        prompt,
        content_type: apiContentType,
        format: isPresentation ? 'presentation' : 'document',
        export_format: exportFormat,
        slide_count: DEFAULT_SLIDE_COUNT,
      };
      console.log('[GeneratePresentation] API request payload:', payload);

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), GAMMA_GENERATION_TIMEOUT_MS);

      const res = await (async () => {
        try {
          return await fetch(`${API_BASE_URL}/api/lms/gamma-content-master`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify(payload),
          });
        } finally {
          window.clearTimeout(timeoutId);
        }
      })();

      const responseContentType = res.headers.get('content-type') || '';
      const raw = responseContentType.includes('application/json')
        ? ((await res.json()) as Record<string, unknown>)
        : ({ message: await res.text() } as Record<string, unknown>);
      const isSuccess = raw.success === true || Number(raw.status_code) === 1;
      if (!res.ok || !isSuccess) {
        throw new Error(readErrorMessage(raw) || 'Failed to generate presentation');
      }

      onSuccess?.(raw);
      setGenerationSuccess(readErrorMessage(raw) || 'Gamma content generated and stored successfully');
      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 2000);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error && err.name === 'AbortError'
        ? 'Gamma generation is taking longer than expected. Please try again in a few minutes.'
        : err instanceof Error ? err.message : 'Generation failed';
      setGenerationError(message);
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
              Generate content
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
                Slides are drafted with <span className="font-semibold text-slate-900">AI</span> from concept intelligence, then added to your content library.
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
                  {mode === 'Classroom' ? 'Classroom Resource' : 'Teacher Resource'}
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

               <div className="mt-6 space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Content Type <span className="text-rose-500">*</span>
            </Label>
            <Select
              value={contentType}
              onValueChange={(value) => setContentType(value ?? 'Presentation')}
            >
              <SelectTrigger className="h-12 rounded-xl border-slate-300 px-4 text-[15px] text-slate-900 shadow-none">
                <SelectValue placeholder="Select content type">
                  {CONTENT_TYPE_OPTIONS.find((option) => option.value === contentType)?.label ?? contentType}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CONTENT_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
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

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Content Type <span className="text-rose-500">*</span>
                </Label>
                <Select
                  value={teacherContentType}
                  onValueChange={(value) => setTeacherContentType(value ?? 'Teacher Presentation')}
                >
                  <SelectTrigger className="h-12 rounded-xl border-slate-300 px-4 text-[15px] text-slate-900 shadow-none">
                    <SelectValue placeholder="Select content type">
                      {teacherContentType}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Teacher Presentation">Teacher Presentation</SelectItem>
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
                Generate with AI
              </>
            )}
          </Button>
        </div>
      </aside>
    </div>
  );
}
