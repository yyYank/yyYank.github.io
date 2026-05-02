export function isTopLevelIndexId(id: string | undefined | null): boolean {
  if (typeof id !== 'string') {
    return false;
  }

  return id === '' || id === 'index' || id.endsWith('/index');
}

export function filterTopLevelIndexEntries<T extends { id: string | undefined | null }>(entries: T[]): T[] {
  return entries.filter((entry) => !isTopLevelIndexId(entry.id));
}

export function findTopLevelIndexEntry<T extends { id: string | undefined | null }>(entries: T[]): T | undefined {
  return entries.find((entry) => isTopLevelIndexId(entry.id));
}
