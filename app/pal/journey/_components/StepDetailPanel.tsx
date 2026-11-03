'use client';

import React from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Compass,
  FileText,
  GitBranch,
  HelpCircle,
  Lightbulb,
  Lock,
  Network,
  RotateCcw,
  Sparkles,
  Trophy,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { recordStageProgression, stageKeyToConceptStage } from '@/app/pal/data/pal-progression';
import { stageHref, type JourneyStageKey } from '@/app/pal/_components/journey-stages';
import {
  milestoneStatusStyle,
  type StudentJourneyStep,
  type MilestoneStatus,
  type ChapterConceptOption,
} from '@/app/pal/journey/data/pal-journey';
import type { UnifiedJourneyNode } from './path/PathJourneyView';

interface StepDetailPanelProps {
  step?: StudentJourneyStep | null;
  selectedNode?: UnifiedJourneyNode | null;
  chapterId: string;
  readOnly?: boolean;
  onOpenKnowledgeGraph?: (() => void) | null;
  onSelectConcept?: (conceptId: string) => void;
  concepts?: ChapterConceptOption[];
  selectedConceptId?: string | null;
}

export function StepDetailPanel({
  step,
  selectedNode,
  chapterId,
  readOnly = false,
  onOpenKnowledgeGraph = null,
  onSelectConcept,
  concepts,
  selectedConceptId,
}: StepDetailPanelProps) {
  const label = selectedNode ? selectedNode.label : step?.label ?? 'Learning Step';
  const status = (selectedNode ? selectedNode.status : step?.status ?? 'completed') as MilestoneStatus;
  const stageKey = (selectedNode ? selectedNode.stageKey : step?.stageKey ?? 'learn') as JourneyStageKey;
  const score = selectedNode ? selectedNode.score : step?.score;
  const timeSpentMinutes = selectedNode ? selectedNode.timeSpentMinutes : step?.timeSpentMinutes ?? 0;
  const facts = selectedNode ? selectedNode.facts : step?.facts ?? [];
  const isStuck = selectedNode ? Boolean(selectedNode.isStuck) : Boolean(step?.isStuck);
  const stuckReason = selectedNode ? selectedNode.stuckReason : step?.stuckReason;
  const repeatReason = selectedNode ? selectedNode.repeatReason : step?.repeatReason;
  const isMainFlow = selectedNode?.source === 'main';
  const isBranchFlow = selectedNode && selectedNode.source !== 'main';

  const style = milestoneStatusStyle(status);
  const href = stageHref(stageKey, { chapterId, conceptId: step?.conceptId ?? null });
  const isMastered = status === 'mastered';

  return (
    <Card
      className={cn(
        'border-2 transition-all shadow-sm overflow-hidden',
        isStuck
          ? 'border-rose-300'
          : isMastered
          ? 'border-emerald-300 bg-gradient-to-br from-emerald-50/20 via-white to-white'
          : style.border
      )}
    >
      {/* ── Concept Dropdown Selector (Controls the entire Journey above) ── */}
      {concepts && concepts.length > 0 && (
        <div className="border-b border-indigo-100 bg-gradient-to-r from-indigo-50/90 via-purple-50/60 to-white px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-200">
                <BookOpen className="h-4 w-4" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <label htmlFor="pal-concept-selector" className="text-xs font-bold text-slate-900">
                    Select Concept to View Journey
                  </label>
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                    {concepts.length} {concepts.length === 1 ? 'concept' : 'concepts'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Select any concept to dynamically view its complete learning journey, attempts, revisits, and mastery in the map above.
                </p>
              </div>
            </div>

            <div className="relative min-w-[280px] sm:min-w-[340px]">
              <select
                id="pal-concept-selector"
                value={selectedConceptId || ''}
                onChange={(e) => onSelectConcept?.(e.target.value)}
                className="w-full appearance-none rounded-xl border-2 border-indigo-200 bg-white py-2 pl-3.5 pr-10 text-xs font-bold text-slate-800 shadow-sm transition-all hover:border-indigo-400 focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/15"
              >
                {concepts.map((concept) => (
                  <option key={concept.id} value={concept.id}>
                    {concept.name} {concept.mastered ? '⭐ (Mastered)' : concept.status ? `• ${concept.status}` : ''}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-indigo-600">
                <ChevronDown className="h-4 w-4 stroke-[2.5]" />
              </div>
            </div>
          </div>
        </div>
      )}

      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            {isMainFlow ? (
              <Badge variant="outline" className="border-indigo-300 bg-indigo-50 text-[10px] font-bold text-indigo-700">
                Main Journey (Fixed &amp; Read-Only)
              </Badge>
            ) : isBranchFlow ? (
              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] font-bold text-amber-800">
                <GitBranch className="mr-1 h-2.5 w-2.5" />
                Learning Flow Attempt
              </Badge>
            ) : (
              <span className="font-semibold text-slate-700">Step {step?.stepNumber}</span>
            )}
            {selectedNode?.subLabel && (
              <>
                <span>•</span>
                <span className="font-semibold text-slate-600">{selectedNode.subLabel}</span>
              </>
            )}
          </div>
          <CardTitle className="mt-1.5 text-lg font-bold text-slate-900">
            {label}
          </CardTitle>
          {selectedNode?.note && (
            <CardDescription className="text-xs text-slate-600 font-medium">
              {selectedNode.note}
            </CardDescription>
          )}
        </div>

        <div className="flex flex-col items-end gap-1">
          <Badge className={cn(style.bg, style.text, 'border', style.border)}>
            {style.label}
          </Badge>
          <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
            <Clock className="h-3 w-3 text-slate-400" />
            {timeSpentMinutes} mins spent
          </span>
          {score != null && (
            <span className="text-xs font-bold text-indigo-700">
              Score: {score}%
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-1">
        {/* Stuck Alert Box */}
        {isStuck && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-rose-900">
                  Student Got Stuck at this Step
                </p>
                <p className="mt-1 text-xs leading-relaxed text-rose-950 font-medium">
                  {stuckReason || 'Student struggled to achieve passing accuracy threshold.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Revisit / Repeat Reason */}
        {repeatReason && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5">
            <div className="flex items-start gap-2.5">
              <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-900">
                  Why the Student Needed to Repeat This Step
                </p>
                <p className="mt-1 text-xs leading-relaxed text-amber-950 font-medium">
                  {repeatReason}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Mastery Trophy Banner */}
        {isMastered && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-300 bg-gradient-to-br from-emerald-50 via-teal-50 to-white p-4 shadow-xs">
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md ring-4 ring-emerald-300/60">
              <Sparkles className="absolute -top-1 -right-1 h-3.5 w-3.5 text-amber-400" />
              <Trophy aria-hidden className="h-5 w-5 text-white" />
            </span>
            <div>
              <p className="text-sm font-bold text-emerald-950">Concept Mastery Certified!</p>
              <p className="text-xs text-emerald-800">
                Final attempt succeeded! Knowledge mastery (88%) and Application mastery (82%) signed off with green tick validation.
              </p>
            </div>
          </div>
        )}

        {/* Facts & Assessment Data */}
        {facts.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              Step Activity &amp; Assessment Facts
            </p>
            <ul className="space-y-1.5 text-xs text-slate-700">
              {facts.map((fact, index) => (
                <li key={index} className="flex items-start gap-1.5">
                  <span className="text-indigo-500">•</span>
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions / CTA */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          {!readOnly && href && (
            <Link
              href={href}
              onClick={() => recordStageProgression(selectedConceptId || step?.conceptId, stageKeyToConceptStage(stageKey, step?.attemptNumber ?? (selectedNode?.source !== 'main' ? 2 : 1)))}
              className={buttonVariants({
                size: 'sm',
                className: 'bg-indigo-600 hover:bg-indigo-700',
              })}
            >
              Open Step Content
              <ArrowRight aria-hidden className="ml-1.5 h-4 w-4" />
            </Link>
          )}

          {onOpenKnowledgeGraph && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenKnowledgeGraph}
              className="gap-1.5 text-slate-700"
            >
              <Network aria-hidden className="h-4 w-4 text-indigo-600" />
              Explore Concept Graph
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
