/**
 * Logs `error` via console.warn, but only in development. For best-effort
 * operations that fail without anything the user can actually see going
 * wrong (reminder scheduling, this app's own init()) -- there's no
 * production user or crash reporter to alarm, but a developer running
 * the app locally should still notice instead of the failure vanishing
 * into a bare `.catch(() => {})`.
 */
export function logDevError(context: string, error: unknown): void {
  if (__DEV__) {
    console.warn(`[${context}]`, error);
  }
}
