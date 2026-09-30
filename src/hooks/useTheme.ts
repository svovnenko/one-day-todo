import { useColorScheme } from 'react-native';

import { resolveScheme } from '@/logic/theme';
import { useAppStore } from '@/store/useAppStore';
import { type Colors, darkColors, lightColors } from '@/theme';

/** Resolves the stored `appearance` setting + the OS scheme into the palette a component should render with. */
export function useTheme(): { scheme: 'light' | 'dark'; colors: Colors } {
  const appearance = useAppStore((s) => s.settings.appearance);
  const systemScheme = useColorScheme();
  const scheme = resolveScheme(appearance, systemScheme === 'dark' ? 'dark' : 'light');
  return { scheme, colors: scheme === 'dark' ? darkColors : lightColors };
}
