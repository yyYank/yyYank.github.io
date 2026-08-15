import { useMemo } from 'react';
import { getPeriodRemainingDays, type Cycle, type TransientNote } from './transientNoteState';

export interface CycleRoutineInfo {
  cycle: Cycle;
  remaining: number;
  note: TransientNote | null;
  incomplete: boolean;
}

export function useCycleRoutine(
  cycle: Cycle,
  notes: TransientNote[],
  templateCycleById: Map<string, Cycle>,
  todayKey: string
): CycleRoutineInfo {
  // todayKeyの更新で残日数を日次で再計算する
  const remaining = useMemo(() => getPeriodRemainingDays(cycle, new Date()), [cycle, todayKey]);
  const note = useMemo(
    () => notes.find((current) => templateCycleById.get(current.templateId) === cycle) ?? null,
    [cycle, notes, templateCycleById]
  );
  const incomplete = useMemo(
    () =>
      notes.some(
        (current) =>
          templateCycleById.get(current.templateId) === cycle &&
          current.items.some((item) => !item.checked)
      ),
    [cycle, notes, templateCycleById]
  );

  return { cycle, remaining, note, incomplete };
}
