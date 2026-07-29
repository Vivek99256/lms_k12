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
