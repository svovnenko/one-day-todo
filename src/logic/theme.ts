export type Appearance = 'system' | 'light' | 'dark';
export type ColorScheme = 'light' | 'dark';

/** Spec 3.6 v8: an explicit Light/Dark choice always wins; 'system' (the default) follows the OS, falling back to light if it can't say. */
export function resolveScheme(appearance: Appearance, systemScheme: ColorScheme | null | undefined): ColorScheme {
  if (appearance === 'light') return 'light';
  if (appearance === 'dark') return 'dark';
  return systemScheme === 'dark' ? 'dark' : 'light';
}
