import { useMemo } from 'react';

import { movableTaskCount } from '@/logic/carryOver';
import { excludeCompleting } from '@/logic/completion';
import { footerLines, type FooterLine } from '@/logic/footer';
import { isListFull } from '@/logic/limits';
import { useAppStore } from '@/store/useAppStore';

/**
 * Wraps the pure footerLines() with its store selectors (spec 3.2/3.4):
 * viewed-list-full, Tomorrow-full, and whether Today has anything
 * movable (excluding mid-completion tasks).
 */
export function useFooterLines(): FooterLine[] {
  const selectedView = useAppStore((s) => s.selectedView);
  const mode = useAppStore((s) => s.mode);
  const todayTasks = useAppStore((s) => s.todayTasks);
  const tomorrowTasks = useAppStore((s) => s.tomorrowTasks);
  const completion = useAppStore((s) => s.completion);

  const viewedFull = isListFull(selectedView === 'today' ? todayTasks.length : tomorrowTasks.length);
  const tomorrowFull = isListFull(tomorrowTasks.length);
  const hasMovable = useMemo(
    () => movableTaskCount(excludeCompleting(todayTasks, completion)) > 0,
    [todayTasks, completion]
  );

  return useMemo(
    () => footerLines({ view: selectedView, mode, viewedFull, tomorrowFull, hasMovable }),
    [selectedView, mode, viewedFull, tomorrowFull, hasMovable]
  );
}
