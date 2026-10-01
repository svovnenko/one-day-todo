import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/useTheme';
import { configureNotificationHandler } from '@/logic/notifications';
import { hideSplashOnce } from '@/logic/splash';
import { type Colors, type } from '@/theme';

// Runs once at import time, before any screen mounts.
configureNotificationHandler();

// Keeps the native splash up past its auto-hide until HomeScreen's
// isReady effect calls hideSplashOnce(), so it goes straight to the real
// list instead of a blank frame while the store loads.
SplashScreen.preventAutoHideAsync().catch(() => {}); // best-effort, never user-visible

// Bumped on each catch so a SECOND failure offers "Restart app" too.
// Module-level, not component state -- a caught error remounts a fresh ErrorBoundary.
let errorBoundaryHitCount = 0;

/** Expo Router convention: exporting `ErrorBoundary` wraps the route tree in a React error boundary. */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
          {/* Nothing more to do if even a restart fails to kick off -- the user is already looking at this screen. */}
          <Text style={styles.errorButton}>Restart app</Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

export default function RootLayout() {
  const { colors } = useTheme();

  // Safety net: never leave the app stuck on the splash if init() throws
  // before setting isReady (also guarded by its own try/catch).
  useEffect(() => {
    const timer = setTimeout(hideSplashOnce, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
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

function makeStyles(colors: Colors) {
  return StyleSheet.create({
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
}
