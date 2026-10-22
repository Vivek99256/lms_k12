/**
 * "I'm stuck on this question" - the small amount of state that lets the chatbot know which exam
 * question a student is looking at.
 *
 * The exam screen records the question the student last touched (or pressed "Ask AI" on); the chat
 * panel reads it when it sends, so a follow-up such as "explain it in simpler words" still means that
 * question. Nothing here is an answer or a mark: it is two ids the backend re-checks against the
 * database, and it only applies while the student is on that exam's attempt screen.
 */

export interface ExamHelpFocus {
  paperId: string;
  questionId: string;
}

/** A question on the exam screen asked for help; DashboardShell opens the panel and sends the prompt. */
export const ASK_ASSISTANT_EVENT = 'lms:ask-assistant';

export interface AskAssistantDetail {
  prompt: string;
  /** Distinguishes two identical prompts so each is sent once. */
  nonce: number;
}

let focus: ExamHelpFocus | null = null;
let nonce = 0;

export function setExamHelpFocus(next: ExamHelpFocus | null): void {
  focus = next;
}

export function getExamHelpFocus(): ExamHelpFocus | null {
  return focus;
}

/** The paper id when the path is a paper's attempt screen (`/exam/online/{id}`), never its result. */
export function examPaperIdFromPath(pathname: string): string | null {
  const match = /^\/exam\/online\/(\d+)\/?$/.exec(pathname.split('?')[0] ?? '');
  return match ? match[1] : null;
}

/**
 * The ids to send with a chat message, or undefined when the student is not on an attempt screen
 * or has not touched a question yet.
 */
export function examHelpPayload(pathname: string): { paper_id: number; question_id: number } | undefined {
  const paperId = examPaperIdFromPath(pathname);
  if (!paperId || !focus || focus.paperId !== paperId) return undefined;

  const paper = Number(focus.paperId);
  const question = Number(focus.questionId);
  return Number.isInteger(paper) && paper > 0 && Number.isInteger(question) && question > 0
    ? { paper_id: paper, question_id: question }
    : undefined;
}

/** Ask the assistant something from anywhere on the page: opens the panel and sends the prompt once. */
export function askAssistant(prompt: string): void {
  if (typeof window === 'undefined') return;
  nonce += 1;
  window.dispatchEvent(new CustomEvent<AskAssistantDetail>(ASK_ASSISTANT_EVENT, { detail: { prompt, nonce } }));
}
