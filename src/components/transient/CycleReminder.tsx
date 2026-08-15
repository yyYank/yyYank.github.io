import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Cycle } from './transientNoteState';
import type { CycleRoutineInfo } from './useCycleRoutine';

const fadeTransition = {
  duration: 0.55,
  ease: [0.22, 1, 0.36, 1] as const,
};

const CYCLE_UI = {
  weekly: {
    periodLabel: '今週',
    routineLabel: '毎週のルーティン',
    badgeClassName: 'border-purple-400/30 bg-purple-400/10 text-purple-200',
    snackbarClassName: 'border-purple-400/30',
    snackbarTextClassName: 'text-purple-100',
  },
  monthly: {
    periodLabel: '今月',
    routineLabel: '毎月のルーティン',
    badgeClassName: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
    snackbarClassName: 'border-amber-400/30',
    snackbarTextClassName: 'text-amber-100',
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
    <div className="fixed bottom-4 right-4 z-40 rounded-full border border-dark-500 bg-dark-800/90 px-4 py-2 text-xs text-gray-300 shadow-lg backdrop-blur">
      <span className="text-purple-200">今週あと{weeklyRemaining}日</span>
      <span className="mx-1.5 text-gray-600">/</span>
      <span className="text-amber-200">今月あと{monthlyRemaining}日</span>
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
          className={`flex items-center gap-2 rounded-full border bg-dark-800/95 py-2 pl-5 pr-2 shadow-xl backdrop-blur ${ui.snackbarClassName}`}
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
            className={`text-sm transition-colors hover:text-white ${ui.snackbarTextClassName}`}
          >
            {message}
          </button>
          <button
            onClick={() => setDismissed(true)}
            type="button"
            aria-label="閉じる"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-dark-500 text-xs text-gray-400 transition-colors hover:text-white"
          >
            ×
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
