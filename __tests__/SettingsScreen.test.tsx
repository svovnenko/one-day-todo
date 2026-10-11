import { act, fireEvent, render } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import SettingsScreen from '../app/settings';
import * as settingsRepo from '@/db/settingsRepo';
import * as tasksRepo from '@/db/tasksRepo';
import { useAppStore } from '@/store/useAppStore';
import { getAllFakeTasks, resetFakeRepos } from './testUtils/fakeRepos';

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
  useAppStore.setState({ settings: { ...settingsRepo.DEFAULT_SETTINGS }, catchUpTasks: [] });
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

describe('Settings -> turning Keep unplanned tasks off while catch-up tasks wait (spec 3.5 v9)', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 7, 10, 0)); // Wednesday 2026-10-07, day mode
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
    jest.useRealTimers();
  });

  /** Seeds `count` undecided leftovers from Tuesday and lets the store pick them up as catch-up tasks. */
  function seedCatchUp(count: number) {
    for (let i = 1; i <= count; i++) tasksRepo.add('2026-10-06', `Leftover ${i}`);
    useAppStore.getState().init();
    expect(useAppStore.getState().catchUpTasks).toHaveLength(count);
  }

  function pressAlertButton(label: string) {
    const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    buttons.find((b) => b.text === label)?.onPress?.();
  }

  it('asks "Delete N kept tasks?" first, and changes nothing yet', async () => {
    seedCatchUp(2);
    const screen = await renderSettings();

    await fireEvent(screen.getByLabelText('Keep unplanned tasks'), 'valueChange', false);

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy.mock.calls[0][0]).toBe('Delete 2 kept tasks?');
    expect(useAppStore.getState().settings.keepUnplanned).toBe(true);
    expect(getAllFakeTasks()).toHaveLength(2);
  });

  it('uses the singular for a single waiting task', async () => {
    seedCatchUp(1);
    const screen = await renderSettings();

    await fireEvent(screen.getByLabelText('Keep unplanned tasks'), 'valueChange', false);

    expect(alertSpy.mock.calls[0][0]).toBe('Delete 1 kept task?');
  });

  it('Cancel leaves the switch on and deletes nothing', async () => {
    seedCatchUp(2);
    const screen = await renderSettings();

    await fireEvent(screen.getByLabelText('Keep unplanned tasks'), 'valueChange', false);
    await act(async () => pressAlertButton('Cancel'));

    expect(useAppStore.getState().settings.keepUnplanned).toBe(true);
    expect(settingsRepo.getSettings().keepUnplanned).toBe(true);
    expect(getAllFakeTasks()).toHaveLength(2);
    expect(useAppStore.getState().catchUpTasks).toHaveLength(2);
  });

  it('Delete saves the setting and the rollover purges the waiting tasks', async () => {
    seedCatchUp(2);
    const screen = await renderSettings();

    await fireEvent(screen.getByLabelText('Keep unplanned tasks'), 'valueChange', false);
    await act(async () => pressAlertButton('Delete'));

    expect(useAppStore.getState().settings.keepUnplanned).toBe(false);
    expect(settingsRepo.getSettings().keepUnplanned).toBe(false);
    expect(getAllFakeTasks()).toHaveLength(0);
    expect(useAppStore.getState().catchUpTasks).toEqual([]);
  });

  it('turning it back ON never asks anything', async () => {
    useAppStore.setState({ settings: { ...settingsRepo.DEFAULT_SETTINGS, keepUnplanned: false } });
    const screen = await renderSettings();

    await fireEvent(screen.getByLabelText('Keep unplanned tasks'), 'valueChange', true);

    expect(alertSpy).not.toHaveBeenCalled();
    expect(useAppStore.getState().settings.keepUnplanned).toBe(true);
  });
});
