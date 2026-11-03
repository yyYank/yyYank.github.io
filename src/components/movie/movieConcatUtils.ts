export function buildConcatList(inputNames: string[]): string {
  return inputNames.map((name) => `file '${name}'\n`).join('');
}

export function buildConcatArgs(listName: string, outputName: string): string[] {
  return ['-f', 'concat', '-safe', '0', '-i', listName, '-c', 'copy', outputName];
}

export function moveItem<T>(items: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
