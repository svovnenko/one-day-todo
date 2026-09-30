import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { configureNotificationHandler } from '@/logic/notifications';
import { hideSplashOnce } from '@/logic/splash';
import { colors, type } from '@/theme';

// Runs once at import time, before any screen mounts.
configureNotificationHandler();

// Keeps the native splash up past its own auto-hide (which would
// otherwise happen as soon as the first frame draws) until HomeScreen's
// isReady effect calls hideSplashOnce() -- so the splash goes straight to
// the real list instead of to a blank white frame while the store is
// still loading. Must be called before anything else renders.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Bumped each time this boundary actually catches an error, so a SECOND
// failure in the same session (most likely: Reload didn't fix it) offers
// "Restart app" too. Module-level rather than component state, since a
// caught error unmounts and remounts a fresh ErrorBoundary instance --
// this only resets on an actual JS reload, which is exactly the point.
let errorBoundaryHitCount = 0;

/**
 * Expo Router's own convention: exporting `ErrorBoundary` from a layout
 * file wraps its route tree in a React error boundary that renders this
 * in place of the crashed screen, instead of a blank/frozen app.
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  const hasFailedBefore = errorBoundaryHitCount > 0;

  useEffect(() => {
    errorBoundaryHitCount += 1;
    console.error(error);
  }, [error]);

  return (
    <SafeAreaView style={styles.errorScreen}>
      <Text style={styles.errorMessage}>Something went wrong.</Text>
      <Pressable onPress={retry} hitSlop={8}>
        <Text style={styles.errorButton}>Reload</Text>
      </Pressable>
      {hasFailedBefore ? (
        <Pressable onPress={() => Updates.reloadAsync().catch(() => {})} hitSlop={8}>
          <Text style={styles.errorButton}>Restart app</Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

export default function RootLayout() {
  // Safety net: never leave the app stuck on the splash screen, even if
  // HomeScreen's init() throws before ever setting isReady (it's also
  // wrapped in its own try/catch, but this is a second, independent
  // guarantee).
  useEffect(() => {
    const timer = setTimeout(hideSplashOnce, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  errorScreen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  errorMessage: { fontSize: type.empty, color: colors.muted },
  errorButton: { fontSize: type.empty, fontWeight: '600', color: colors.text },
});
