export type CareerRecord = Record<string, unknown>;

export type CareerSection =
  | 'plan'
  | 'explore'
  | 'assessment'
  | 'colleges'
  | 'courses'
  | 'employers'
  | 'experts'
  | 'sectors'
  | 'match';

export interface InterestQuestion {
  id: string;
  text: string;
}

export interface InterestResult {
  area: string;
  score: number;
  description: string;
}

export interface RequestState<T> {
  data: T;
  loading: boolean;
  error: string;
}

export type CertaintyLevel = 'not_sure' | 'somewhat_sure' | 'very_sure';

export interface AspirationSnapshot {
  id: number;
  student_id: string;
  grade: number;
  academic_year: string;
  occupation_id: string | null;
  occupation_name: string | null;
  expectation_age_30: string | null;
  certainty: number | null;
  parent_occupation_id: string | null;
  parent_occupation_name: string | null;
  source: string;
  is_current: boolean;
  captured_at: string;
}

export interface AspirationInput {
  occupation_id?: string;
  occupation_name?: string;
  expectation_age_30: string;
  certainty: CertaintyLevel;
  parent_occupation_id?: string;
  parent_occupation_name?: string;
}
