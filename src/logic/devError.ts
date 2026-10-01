/**
 * console.warn, dev-only -- for best-effort failures with nothing for a
 * user to see (reminder scheduling, init()), so they don't silently
 * vanish into a bare `.catch(() => {})` during local development.
 */
export function logDevError(context: string, error: unknown): void {
  if (__DEV__) {
    console.warn(`[${context}]`, error);
  }
}
