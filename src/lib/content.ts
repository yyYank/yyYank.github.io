export function isTopLevelIndexId(id: string | undefined | null): boolean {
  if (typeof id !== 'string') {
    return false;
  }

  return id === '' || id === 'index' || id.endsWith('/index');
}
