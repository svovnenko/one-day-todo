import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { configureNotificationHandler } from '@/logic/notifications';
import { hideSplashOnce } from '@/logic/splash';
import { colors } from '@/theme';

// Runs once at import time, before any screen mounts.
configureNotificationHandler();

// Keeps the native splash up past its own auto-hide (which would
// otherwise happen as soon as the first frame draws) until HomeScreen's
// isReady effect calls hideSplashOnce() -- so the splash goes straight to
// the real list instead of to a blank white frame while the store is
// still loading. Must be called before anything else renders.
SplashScreen.preventAutoHideAsync().catch(() => {});

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
          }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
