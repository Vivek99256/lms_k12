/**
 * What a story picture does when the browser cannot load it: one bounded retry, then a labelled frame instead of a silent gap.
 *
 * NO REACT HERE, so every rule is testable with node:test. The retry loads the SAME address again (a signed picture address cannot be changed
 * without breaking its signature, and a failed load is not cached by the browser); it is not a different picture. After the retry the player
 * shows the picture's alternative text in a frame that says the picture could not be loaded, so a scene never looks as if it had no picture by
 * accident, and a test can see the final state.
 */
export type ImageLoadStatus = 'loading' | 'loaded' | 'retrying' | 'failed';

export interface ImageLoadState {
  status: ImageLoadStatus;
  /** How many times the picture has been asked for again after a failure. */
  attempts: number;
}

/** A failed picture is asked for once more, no more. */
export const MAX_IMAGE_RETRIES = 1;

export const INITIAL_IMAGE_LOAD: ImageLoadState = { status: 'loading', attempts: 0 };

export function imageLoaded(state: ImageLoadState = INITIAL_IMAGE_LOAD): ImageLoadState {
  return { status: 'loaded', attempts: state.attempts };
}

/** The next state after a failed load: retry while retries remain, then give up. */
export function imageFailed(state: ImageLoadState = INITIAL_IMAGE_LOAD): ImageLoadState {
  return state.attempts < MAX_IMAGE_RETRIES
    ? { status: 'retrying', attempts: state.attempts + 1 }
    : { status: 'failed', attempts: state.attempts + 1 };
}

/** The key that makes the browser ask for the same address again: it changes with every retry. */
export function imageAttemptKey(url: string, state: ImageLoadState): string {
  return `${url}#${state.attempts}`;
}

/** What the frame says when the picture could not be loaded. Always names the picture by its own alternative text. */
export function failedPictureLabel(alt: string): string {
  const what = alt.trim();

  return what === '' ? 'This picture could not be loaded.' : `This picture could not be loaded: ${what}`;
}
