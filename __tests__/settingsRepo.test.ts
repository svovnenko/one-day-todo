// jest.setup.ts swaps in-memory fakes for the repos everywhere; this file
// deliberately loads the REAL settingsRepo (jest.requireActual) over a
// tiny fake database, to pin down how stored values are parsed -- chiefly
// that a missing `keepUnplanned` means ON, so existing installs get the
// v9 behaviour without migrating anything (spec 3.5).
const mockRows: Record<string, string> = {};
const mockDb = {
  getFirstSync: (_sql: string, key: string) => (key in mockRows ? { value: mockRows[key] } : null),
  runSync: (_sql: string, key: string, value: string) => {
    mockRows[key] = value;
  },
};
jest.mock('@/db/database', () => ({ getDb: () => mockDb }));

const repo = jest.requireActual<typeof import('@/db/settingsRepo')>('@/db/settingsRepo');

beforeEach(() => {
  for (const key of Object.keys(mockRows)) delete mockRows[key];
});

describe('keepUnplanned (spec 3.5/3.6 v9)', () => {
  it('a missing stored value means on', () => {
    expect(repo.getSettings().keepUnplanned).toBe(true);
  });

  it("'1' is on and '0' is off", () => {
    mockRows.keepUnplanned = '1';
    expect(repo.getSettings().keepUnplanned).toBe(true);
    mockRows.keepUnplanned = '0';
    expect(repo.getSettings().keepUnplanned).toBe(false);
  });

  it('setKeepUnplanned stores 1 / 0', () => {
    repo.setKeepUnplanned(false);
    expect(mockRows.keepUnplanned).toBe('0');
    repo.setKeepUnplanned(true);
    expect(mockRows.keepUnplanned).toBe('1');
  });
});
