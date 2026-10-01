import * as SplashScreen from 'expo-splash-screen';

let hidden = false;

/** Hides the native splash once per app run -- safe to call from multiple places (app/index.tsx's ready effect, app/_layout.tsx's safety-net timer) without redundant calls. */
export function hideSplashOnce(): void {
  if (hidden) return;
  hidden = true;
  SplashScreen.hideAsync().catch(() => {}); // best-effort, never user-visible
}
