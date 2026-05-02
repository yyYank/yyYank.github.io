export function isTopLevelIndexSlug(slug: string): boolean {
  return slug === '' || slug === 'index' || slug.endsWith('/index');
}
