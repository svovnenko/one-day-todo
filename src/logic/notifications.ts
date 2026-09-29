import * as Notifications from 'expo-notifications';

const REMINDER_IDENTIFIER = 'plan-tomorrow-reminder';

/** Shows the reminder as a normal banner if it ever fires while the app is foregrounded. */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Requests notification permission if it hasn't been decided yet. iOS only
 * shows its system prompt once ever, so calling this repeatedly (e.g. every
 * time schedule settings change) is safe -- it's a no-op after the first
 * real ask. Returns whether the app is currently allowed to notify.
 */
export async function requestPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function cancelAll(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/** Spec 3.7: a daily local notification at P, "Plan tomorrow" / "Write tomorrow's list." */
export async function scheduleDailyReminder(planningTime: string): Promise<void> {
  await cancelAll();
  const [hour, minute] = planningTime.split(':').map(Number);
  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_IDENTIFIER,
    content: { title: 'Plan tomorrow', body: "Write tomorrow's list." },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
  });
}

/**
 * Applies the current reminder setting: cancels everything if the
 * reminder is off, otherwise (re)requests permission and (re)schedules the
 * daily reminder at the current planning time. Call this at launch and
 * whenever schedule settings change (spec 3.6). If permission is denied,
 * this silently does nothing further -- the app works normally with no
 * reminder (spec 3.7).
 */
export async function applyReminderSchedule(settings: {
  reminderEnabled: boolean;
  planningTime: string;
}): Promise<void> {
  if (!settings.reminderEnabled) {
    await cancelAll();
    return;
  }
  const granted = await requestPermission();
  if (!granted) return;
  await scheduleDailyReminder(settings.planningTime);
}
