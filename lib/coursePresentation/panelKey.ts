/**
 * The React key of the generation panel. The panel reads its run from the pre-flight answer once, when it mounts, so the key
 * must change whenever the server names a different run for the chapter: then the panel mounts again with that run instead of
 * keeping an older one. A run started inside the panel does not change the pre-flight answer, so it does not change the key.
 */
export function panelKey(requestKey: string, run: { run: string } | null | undefined): string {
  return `${requestKey}:${run?.run ?? 'none'}`;
}
