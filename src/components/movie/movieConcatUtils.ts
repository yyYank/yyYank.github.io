export type VideoSize = { width: number; height: number };

export function buildConcatFilter(count: number, { width, height }: VideoSize): string {
  const parts: string[] = [];
  const pairs: string[] = [];
  for (let i = 0; i < count; i++) {
    parts.push(
      `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}]`,
      `[${i}:a]aformat=sample_rates=44100:channel_layouts=stereo[a${i}]`
    );
    pairs.push(`[v${i}][a${i}]`);
  }
  parts.push(`${pairs.join('')}concat=n=${count}:v=1:a=1[outv][outa]`);
  return parts.join(';');
}

export function buildConcatArgs(inputNames: string[], outputName: string, size: VideoSize): string[] {
  return [
    ...inputNames.flatMap((name) => ['-i', name]),
    '-filter_complex',
    buildConcatFilter(inputNames.length, size),
    '-map',
    '[outv]',
    '-map',
    '[outa]',
    '-c:v',
    'mpeg4',
    '-c:a',
    'aac',
    outputName,
  ];
}

export function moveItem<T>(items: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
