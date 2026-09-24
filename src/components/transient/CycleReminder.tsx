import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Cycle } from './transientNoteState';
import type { CycleRoutineInfo } from './useCycleRoutine';

const fadeTransition = {
  duration: 0.3,
  ease: [0.2, 0.8, 0.2, 1] as const,
};

const CYCLE_UI = {
  weekly: {
    periodLabel: '今週',
    routineLabel: '毎週のルーティン',
    badgeClassName: 'border-accent/30 bg-accent-soft text-accent',
    snackbarClassName: 'border-accent/30',
    snackbarTextClassName: 'text-accent',
  },
  monthly: {
    periodLabel: '今月',
    routineLabel: '毎月のルーティン',
    badgeClassName: 'border-warning/30 bg-warning/10 text-warning',
    snackbarClassName: 'border-warning/30',
    snackbarTextClassName: 'text-warning',
  },
} as const;

type ReminderCycle = keyof typeof CYCLE_UI;

export function CycleBadge({ cycle, remaining }: { cycle: Cycle; remaining: number }) {
  if (cycle !== 'weekly' && cycle !== 'monthly') {
    return null;
  }

  const ui = CYCLE_UI[cycle];
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs ${ui.badgeClassName}`}>
      {ui.periodLabel} あと{remaining}日
    </span>
  );
}

export function RemainingDaysChip({
  weeklyRemaining,
  monthlyRemaining,
}: {
  weeklyRemaining: number;
  monthlyRemaining: number;
}) {
  return (
    <div className="fixed bottom-4 right-4 z-40 rounded-full border border-border-strong bg-surface/90 px-4 py-2 text-xs text-muted shadow-lg backdrop-blur">
      <span className="text-accent">今週あと{weeklyRemaining}日</span>
      <span className="mx-1.5 text-faint">/</span>
      <span className="text-warning">今月あと{monthlyRemaining}日</span>
    </div>
  );
}

export function CycleSnackbar({
  routine,
  threshold,
}: {
  routine: CycleRoutineInfo;
  threshold: number;
}) {
  const [dismissed, setDismissed] = useState(false);
  const { cycle, remaining, note, incomplete } = routine;

  if (cycle !== 'weekly' && cycle !== 'monthly') {
    return null;
  }

  const ui = CYCLE_UI[cycle as ReminderCycle];
  const show = !dismissed && incomplete && remaining <= threshold;
  const message =
    remaining === 0
      ? `${ui.periodLabel}最終日です。${ui.routineLabel}が未完了です`
      : `${ui.routineLabel}が未完了です(${ui.periodLabel}あと${remaining}日)`;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={fadeTransition}
          className={`flex items-center gap-2 rounded-full border bg-surface/95 py-2 pl-5 pr-2 shadow-xl backdrop-blur ${ui.snackbarClassName}`}
        >
          <button
            onClick={() => {
              if (note) {
                document
                  .getElementById(`transient-note-${note.id}`)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }}
            type="button"
            className={`text-sm transition-colors hover:text-text ${ui.snackbarTextClassName}`}
          >
            {message}
          </button>
          <button
            onClick={() => setDismissed(true)}
            type="button"
            aria-label="閉じる"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-border-strong text-xs text-muted transition-colors hover:text-text"
          >
            ×
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
