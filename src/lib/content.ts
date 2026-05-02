export function isTopLevelIndexSlug(slug: string | undefined | null): boolean {
  if (typeof slug !== 'string') {
    return false;
  }

  return slug === '' || slug === 'index' || slug.endsWith('/index');
}
