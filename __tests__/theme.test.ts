import { resolveScheme } from '@/logic/theme';

describe('resolveScheme', () => {
  it('an explicit Light/Dark choice always wins, regardless of the system scheme', () => {
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });

  it('"system" follows the OS scheme', () => {
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', 'light')).toBe('light');
  });

  it('"system" with no OS answer falls back to light', () => {
    expect(resolveScheme('system', null)).toBe('light');
    expect(resolveScheme('system', undefined)).toBe('light');
  });
});
