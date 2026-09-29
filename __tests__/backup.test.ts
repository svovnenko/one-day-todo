import { BACKUP_APP_ID, BACKUP_VERSION, buildExport, validateBackup } from '@/logic/backup';

describe('buildExport', () => {
  it('builds the spec 3.8 JSON shape', () => {
    const now = new Date(2026, 8, 29, 21, 14);
    const settings = { planningTime: '20:00', dayEndTime: '04:00', reminderEnabled: true };
    const tasks = [{ text: 'Call bank', day: '2026-09-30', position: 1, carryCount: 2 }];

    const result = buildExport(now, settings, tasks);

    expect(result.app).toBe(BACKUP_APP_ID);
    expect(result.version).toBe(BACKUP_VERSION);
    expect(result.settings).toEqual(settings);
    expect(result.tasks).toEqual(tasks);
    expect(typeof result.exportedAt).toBe('string');
  });
});

describe('validateBackup', () => {
  const valid = {
    app: 'one-day-todo',
    version: 1,
    exportedAt: '2026-09-29T21:14:00.000Z',
    settings: { planningTime: '20:00', dayEndTime: '04:00', reminderEnabled: true },
    tasks: [{ text: 'Call bank', day: '2026-09-30', position: 1, carryCount: 2 }],
  };

  it('accepts a well-formed backup', () => {
    const result = validateBackup(valid);
    expect(result).not.toBeNull();
    expect(result?.tasks).toHaveLength(1);
  });

  it('accepts an empty task list', () => {
    expect(validateBackup({ ...valid, tasks: [] })).not.toBeNull();
  });

  it.each([
    ['not an object', 'a random string'],
    ['null', null],
    ['array', [1, 2, 3]],
    ['wrong app id', { ...valid, app: 'some-other-app' }],
    ['wrong version', { ...valid, version: 2 }],
    ['missing settings', { ...valid, settings: undefined }],
    ['bad planningTime format', { ...valid, settings: { ...valid.settings, planningTime: '8pm' } }],
    ['planningTime equals dayEndTime', { ...valid, settings: { ...valid.settings, planningTime: '04:00' } }],
    ['reminderEnabled not boolean', { ...valid, settings: { ...valid.settings, reminderEnabled: 'yes' } }],
    ['tasks not an array', { ...valid, tasks: 'nope' }],
    ['task missing text', { ...valid, tasks: [{ day: '2026-09-30', position: 1, carryCount: 0 }] }],
    ['task text too long', { ...valid, tasks: [{ text: 'x'.repeat(201), day: '2026-09-30', position: 1, carryCount: 0 }] }],
    ['task text empty', { ...valid, tasks: [{ text: '', day: '2026-09-30', position: 1, carryCount: 0 }] }],
    ['task bad day format', { ...valid, tasks: [{ text: 'x', day: '30-09-2026', position: 1, carryCount: 0 }] }],
    ['task position not a number', { ...valid, tasks: [{ text: 'x', day: '2026-09-30', position: '1', carryCount: 0 }] }],
  ])('rejects: %s', (_label, input) => {
    expect(validateBackup(input)).toBeNull();
  });
});
