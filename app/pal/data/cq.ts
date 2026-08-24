import type {
  CareerQuestState,
  CareerPathway,
  CareerActivity,
  CareerInterest,
  CareerQuestSummary,
  PathwayWithSkills,
  StageDefinition,
  InterestDeclarationInput,
  ActivityCompletionInput,
} from './cq-types';
import type { PalCqStore } from './cq-store';
import { resolveStageFromGrade } from './cq-store';

export interface PalCqService {
  getCareerQuestState(
    userId: string,
    subInstituteId: string,
    syear: string,
    grade: number | null
  ): Promise<CareerQuestState>;

  getStageDefinitions(): Promise<StageDefinition[]>;

  getCareerPathways(activeOnly: boolean): Promise<CareerPathway[]>;

  getPathwayWithSkills(
    pathwayId: number,
    userId: string,
    subInstituteId: string,
    syear: string
  ): Promise<PathwayWithSkills | null>;

  recordActivity(
    userId: string,
    subInstituteId: string,
    syear: string,
    grade: number | null,
    input: ActivityCompletionInput
  ): Promise<CareerActivity>;

  declareInterest(
    userId: string,
    subInstituteId: string,
    syear: string,
    grade: number | null,
    input: InterestDeclarationInput
  ): Promise<CareerInterest>;

  getCareerQuestSummary(
    userId: string,
    subInstituteId: string,
    syear: string,
    primaryPathwayId: number | null,
    secondaryPathwayId: number | null
  ): Promise<CareerQuestSummary>;
}

export function createPalCqService(store: PalCqStore): PalCqService {
  return {
    async getCareerQuestState(userId, subInstituteId, syear, grade) {
      let state = await store.getCareerQuestState(userId, subInstituteId, syear);
      const stage = resolveStageFromGrade(grade);

      if (!state) {
        state = await store.upsertCareerQuestState(
          userId,
          subInstituteId,
          syear,
          grade,
          stage,
          null,
          null,
          null,
          1,
          null
        );
      } else if (grade != null && state.grade !== grade) {
        const updatedStage = resolveStageFromGrade(grade);
        state = await store.upsertCareerQuestState(
          userId,
          subInstituteId,
          syear,
          grade,
          updatedStage,
          state.primaryPathwayId,
          state.secondaryPathwayId,
          state.interestDeclaration,
          state.questLevel,
          state.progressInfo
        );
      }

      return state;
    },

    async getStageDefinitions() {
      return store.getStageDefinitions();
    },

    async getCareerPathways(activeOnly) {
      return store.getCareerPathways(activeOnly);
    },

    async getPathwayWithSkills(pathwayId, userId, subInstituteId, syear) {
      return store.getPathwayWithSkills(pathwayId, userId, subInstituteId, syear);
    },

    async recordActivity(userId, subInstituteId, syear, grade, input) {
      const state = await this.getCareerQuestState(userId, subInstituteId, syear, grade);
      const activity = await store.recordCareerActivity({
        userId,
        subInstituteId,
        syear,
        activityType: input.activityType,
        activityName: input.activityName,
        pathwayId: input.pathwayId ?? null,
        skillId: input.skillId ?? null,
        sourceId: input.sourceId ?? null,
        metadata: input.metadata ?? null,
      });

      if (input.skillId != null && state.primaryPathwayId != null) {
        await store.upsertStudentProgress(
          userId,
          subInstituteId,
          syear,
          state.primaryPathwayId,
          input.skillId,
          'in_progress',
          true,
          new Date().toISOString().slice(0, 19).replace('T', ' ')
        );
      }

      return activity;
    },

    async declareInterest(userId, subInstituteId, syear, grade, input) {
      const state = await this.getCareerQuestState(userId, subInstituteId, syear, grade);
      const interest = await store.declareInterest(userId, subInstituteId, syear, input);

      const interestDeclaration = state.interestDeclaration ?? {};
      const key = `${input.interestType}:${input.interestValue}`;
      interestDeclaration[key] = {
        type: input.interestType,
        value: input.interestValue,
        metadata: input.metadata ?? null,
        declaredAt: new Date().toISOString(),
      };

      await store.upsertCareerQuestState(
        userId,
        subInstituteId,
        syear,
        state.grade,
        state.currentStage,
        state.primaryPathwayId,
        state.secondaryPathwayId,
        interestDeclaration,
        state.questLevel,
        state.progressInfo
      );

      return interest;
    },

    async getCareerQuestSummary(
      userId,
      subInstituteId,
      syear,
      primaryPathwayId,
      secondaryPathwayId
    ) {
      return store.getCareerQuestSummary(userId, subInstituteId, syear, primaryPathwayId, secondaryPathwayId);
    },
  };
}
