import type { GanbariRecord } from './ganbariData';

export const STAMPS = [
  '💮', '🌸', '🌈', '❤️', '⭐', '🌻', '🎀', '🦋', '🍀', '🌷',
  '🌟', '🎵', '🐱', '🐶', '🍓', '🍎', '🌙', '☀️', '🐣', '🐰',
  '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐸', '🐵', '🐧', '🦉',
  '🦄', '🐝', '🐞', '🐢', '🐬', '🐳', '🦖', '🦕', '🐙', '🦀',
  '🍒', '🍊', '🍋', '🍉', '🍇', '🍑', '🍍', '🥝', '🥕', '🌽',
  '🍙', '🍣', '🍩', '🍪', '🍰', '🧁', '🍦', '🍭', '🍬', '🍫',
  '⚽', '🏀', '⚾', '🎾', '🏐', '🏓', '🛹', '🚲', '🎯', '🪁',
  '🎹', '🎸', '🎺', '🎻', '🥁', '🎨', '🖍️', '📚', '✏️', '🔬',
  '🚗', '🚕', '🚒', '🚑', '🚀', '✈️', '🚂', '⛵', '🏠', '🌊',
  '😊', '😆', '🥳', '😎', '🤩', '💪', '👏', '👍', '✨', '🎉',
] as const;

const STAMP_SET = new Set<string>(STAMPS);

export function countOwnedStamps(
  records: GanbariRecord[],
  personId: string,
): Record<string, number> {
  return records.reduce<Record<string, number>>((counts, record) => {
    if (record.personId === personId && STAMP_SET.has(record.stamp)) {
      counts[record.stamp] = (counts[record.stamp] ?? 0) + 1;
    }
    return counts;
  }, {});
}
