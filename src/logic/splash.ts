import * as SplashScreen from 'expo-splash-screen';

let hidden = false;

/**
 * Hides the native launch splash screen, but only ever actually does it
 * once per app run -- safe to call from multiple places (the "ready"
 * effect in app/index.tsx, and the safety-net timer in app/_layout.tsx)
 * without redundant native calls.
 */
export function hideSplashOnce(): void {
  if (hidden) return;
  hidden = true;
  SplashScreen.hideAsync().catch(() => {});
}
