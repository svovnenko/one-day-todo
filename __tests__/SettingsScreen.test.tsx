import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import SettingsScreen from '../app/settings';
import * as settingsRepo from '@/db/settingsRepo';
import { useAppStore } from '@/store/useAppStore';
import { resetFakeRepos } from './testUtils/fakeRepos';

function renderSettings() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 320, height: 640 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <SettingsScreen />
    </SafeAreaProvider>
  );
}

beforeEach(() => {
  resetFakeRepos();
  // The store is a module-level singleton shared by every test in this file.
  useAppStore.setState({ settings: { ...settingsRepo.DEFAULT_SETTINGS } });
});

describe('Settings -> Schedule (spec 3.6 v9)', () => {
  it('has a Keep unplanned tasks switch, on by default, with its caption', async () => {
    const screen = await renderSettings();

    expect(screen.getByText('Keep unplanned tasks')).toBeTruthy();
    expect(
      screen.getByText('If you skip the evening planning, unfinished tasks wait until you next open the app.')
    ).toBeTruthy();
    expect(screen.getByLabelText('Keep unplanned tasks').props.value).toBe(true);
  });

  it('the Day ends at caption says the day switches (the old "deleted" text is no longer always true)', async () => {
    const screen = await renderSettings();

    expect(screen.getByText('The day switches at this time.')).toBeTruthy();
    expect(screen.queryByText('Tasks left after this time are deleted.')).toBeNull();
  });

  it('turning it off with nothing waiting just saves the setting, with no alert', async () => {
    const screen = await renderSettings();

    await fireEvent(screen.getByLabelText('Keep unplanned tasks'), 'valueChange', false);

    expect(useAppStore.getState().settings.keepUnplanned).toBe(false);
    expect(settingsRepo.getSettings().keepUnplanned).toBe(false);
  });
});
