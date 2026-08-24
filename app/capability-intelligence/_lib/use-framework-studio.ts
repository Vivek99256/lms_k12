'use client';

/**
 * Ported from G2G's `hooks/use-competency-studio.ts` — exports
 * `useCompetencyStudio`, unchanged in shape and behavior. Same
 * `buildSessionContext()`-per-call adaptation as `use-libraries-taxonomy.ts`.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  buildSessionContext,
  competencyStudioService,
  type Framework,
  type FrameworkPayload,
  type FrameworkStructureNode,
  type MappingReview,
  type Matrix,
  type ProficiencyLevelPayload,
  type ProficiencyScale,
  type ReviewCounts,
  type RoleRow,
  type StudioSummary,
  type WeightRow,
} from './framework-studio-api';

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export interface MutationResult {
  ok: boolean;
  message: string;
}

export interface UseCompetencyStudioState {
  loading: boolean;
  error: string | null;
  summary: StudioSummary | null;
  structure: FrameworkStructureNode[];
  proficiency: ProficiencyScale | null;
  weights: WeightRow[];
  frameworks: Framework[];
  roles: RoleRow[];
  retry: () => void;

  matrix: Matrix | null;
  matrixLoading: boolean;
  matrixError: string | null;
  loadMatrix: (category: string | null, jobroles: string[]) => Promise<void>;

  reviews: MappingReview[];
  reviewCounts: ReviewCounts;
  reviewsLoading: boolean;
  reviewsError: string | null;
  loadReviews: (status: string) => Promise<void>;

  saving: boolean;
  actionMessage: string | null;
  actionError: string | null;
  clearMessages: () => void;

  saveCell: (jobrole: string, skill: string, level: string) => Promise<MutationResult>;
  clearCell: (jobrole: string, skill: string) => Promise<MutationResult>;
  saveWeights: (rows: WeightRow[]) => Promise<MutationResult>;
  createFramework: (payload: FrameworkPayload) => Promise<MutationResult>;
  updateFramework: (id: number, payload: FrameworkPayload) => Promise<MutationResult>;
  cloneFramework: (id: number, name?: string) => Promise<MutationResult>;
  deleteFramework: (id: number) => Promise<MutationResult>;
  approveReview: (id: number, note?: string) => Promise<MutationResult>;
  rejectReview: (id: number, note?: string) => Promise<MutationResult>;
  bulkApproveReviews: (ids?: number[]) => Promise<MutationResult>;
  submitReview: (payload: { jobrole: string; department?: string; framework_id?: number; changes_count?: number; changes?: string }) => Promise<MutationResult>;
  createLevel: (payload: ProficiencyLevelPayload) => Promise<MutationResult>;
  updateLevel: (id: number, payload: ProficiencyLevelPayload) => Promise<MutationResult>;
  deleteLevel: (id: number) => Promise<MutationResult>;
}

const EMPTY_COUNTS: ReviewCounts = { pending: 0, approved: 0, rejected: 0 };

export function useCompetencyStudio(structureSearch = ''): UseCompetencyStudioState {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<StudioSummary | null>(null);
  const [structure, setStructure] = useState<FrameworkStructureNode[]>([]);
  const [proficiency, setProficiency] = useState<ProficiencyScale | null>(null);
  const [weights, setWeights] = useState<WeightRow[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);

  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [matrixError, setMatrixError] = useState<string | null>(null);

  const [reviews, setReviews] = useState<MappingReview[]>([]);
  const [reviewCounts, setReviewCounts] = useState<ReviewCounts>(EMPTY_COUNTS);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const session = buildSessionContext();
      const [summaryRes, structureRes, proficiencyRes, weightsRes, frameworksRes, rolesRes] = await Promise.all([
        competencyStudioService.getSummary(session),
        competencyStudioService.getFrameworkStructure(session, structureSearch || undefined),
        competencyStudioService.getProficiencyScale(session),
        competencyStudioService.getWeights(session),
        competencyStudioService.listFrameworks(session, { per_page: 100 }),
        competencyStudioService.getRoles(session, { per_page: 6 }),
      ]);
      setSummary(summaryRes.data ?? null);
      setStructure(structureRes.data ?? []);
      setProficiency(proficiencyRes.data ?? null);
      setWeights(weightsRes.data ?? []);
      setFrameworks(frameworksRes.data ?? []);
      setRoles(rolesRes.data ?? []);
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the studio.'));
    } finally {
      setLoading(false);
    }
  }, [structureSearch]);

  useEffect(() => {
    queueMicrotask(() => {
      load();
    });
  }, [load]);

  const loadMatrix = useCallback(async (category: string | null, jobroles: string[]) => {
    if (jobroles.length === 0) {
      setMatrix(null);
      return;
    }
    setMatrixLoading(true);
    setMatrixError(null);
    try {
      const res = await competencyStudioService.getMatrix(buildSessionContext(), {
        category: category ?? undefined,
        jobroles,
      });
      setMatrix(res.data ?? null);
    } catch (err) {
      setMatrixError(toMessage(err, 'Failed to load the matrix.'));
      setMatrix(null);
    } finally {
      setMatrixLoading(false);
    }
  }, []);

  const loadReviews = useCallback(async (status: string) => {
    setReviewsLoading(true);
    setReviewsError(null);
    try {
      const res = await competencyStudioService.listReviews(buildSessionContext(), status);
      setReviews(res.data ?? []);
      setReviewCounts(res.counts ?? EMPTY_COUNTS);
    } catch (err) {
      setReviewsError(toMessage(err, 'Failed to load reviews.'));
      setReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  }, []);

  const runMutation = useCallback(
    async (
      action: () => Promise<{ message: string }>,
      fallback: string,
      afterSuccess?: () => Promise<void> | void,
    ): Promise<MutationResult> => {
      setSaving(true);
      setActionError(null);
      setActionMessage(null);
      try {
        const response = await action();
        setActionMessage(response.message);
        if (afterSuccess) await afterSuccess();
        return { ok: true, message: response.message };
      } catch (mutationError) {
        const message = toMessage(mutationError, fallback);
        setActionError(message);
        return { ok: false, message };
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const saveCell = useCallback(
    (jobrole: string, skill: string, level: string) =>
      runMutation(() => competencyStudioService.saveCell(buildSessionContext(), jobrole, skill, level), 'Failed to save the mapping.'),
    [runMutation],
  );

  const clearCell = useCallback(
    (jobrole: string, skill: string) =>
      runMutation(() => competencyStudioService.clearCell(buildSessionContext(), jobrole, skill), 'Failed to clear the mapping.'),
    [runMutation],
  );

  const saveWeights = useCallback(
    (rows: WeightRow[]) =>
      runMutation(
        () => competencyStudioService.saveWeights(buildSessionContext(), rows),
        'Failed to save weighting.',
        () => setWeights(rows),
      ),
    [runMutation],
  );

  const createFramework = useCallback(
    (payload: FrameworkPayload) =>
      runMutation(() => competencyStudioService.createFramework(buildSessionContext(), payload), 'Failed to create the framework.', load),
    [runMutation, load],
  );

  const updateFramework = useCallback(
    (id: number, payload: FrameworkPayload) =>
      runMutation(() => competencyStudioService.updateFramework(buildSessionContext(), id, payload), 'Failed to update the framework.', load),
    [runMutation, load],
  );

  const cloneFramework = useCallback(
    (id: number, name?: string) =>
      runMutation(() => competencyStudioService.cloneFramework(buildSessionContext(), id, name), 'Failed to clone the framework.', load),
    [runMutation, load],
  );

  const deleteFramework = useCallback(
    (id: number) =>
      runMutation(() => competencyStudioService.deleteFramework(buildSessionContext(), id), 'Failed to delete the framework.', load),
    [runMutation, load],
  );

  const approveReview = useCallback(
    (id: number, note?: string) =>
      runMutation(() => competencyStudioService.reviewAction(buildSessionContext(), id, 'approve', note), 'Failed to approve the review.'),
    [runMutation],
  );

  const rejectReview = useCallback(
    (id: number, note?: string) =>
      runMutation(() => competencyStudioService.reviewAction(buildSessionContext(), id, 'reject', note), 'Failed to reject the review.'),
    [runMutation],
  );

  const bulkApproveReviews = useCallback(
    (ids?: number[]) => runMutation(() => competencyStudioService.bulkApprove(buildSessionContext(), ids), 'Failed to bulk approve.'),
    [runMutation],
  );

  const submitReview = useCallback(
    (payload: { jobrole: string; department?: string; framework_id?: number; changes_count?: number; changes?: string }) =>
      runMutation(() => competencyStudioService.submitReview(buildSessionContext(), payload), 'Failed to submit for review.'),
    [runMutation],
  );

  const createLevel = useCallback(
    (payload: ProficiencyLevelPayload) =>
      runMutation(() => competencyStudioService.createLevel(buildSessionContext(), payload), 'Failed to add the level.', load),
    [runMutation, load],
  );

  const updateLevel = useCallback(
    (id: number, payload: ProficiencyLevelPayload) =>
      runMutation(() => competencyStudioService.updateLevel(buildSessionContext(), id, payload), 'Failed to update the level.', load),
    [runMutation, load],
  );

  const deleteLevel = useCallback(
    (id: number) =>
      runMutation(() => competencyStudioService.deleteLevel(buildSessionContext(), id), 'Failed to delete the level.', load),
    [runMutation, load],
  );

  return {
    loading,
    error,
    summary,
    structure,
    proficiency,
    weights,
    frameworks,
    roles,
    retry: load,

    matrix,
    matrixLoading,
    matrixError,
    loadMatrix,

    reviews,
    reviewCounts,
    reviewsLoading,
    reviewsError,
    loadReviews,

    saving,
    actionMessage,
    actionError,
    clearMessages: () => {
      setActionMessage(null);
      setActionError(null);
    },

    saveCell,
    clearCell,
    saveWeights,
    createFramework,
    updateFramework,
    cloneFramework,
    deleteFramework,
    approveReview,
    rejectReview,
    bulkApproveReviews,
    submitReview,
    createLevel,
    updateLevel,
    deleteLevel,
  };
}
