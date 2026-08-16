/* ナビに載せるページの一覧と、非表示設定(localStorage)の読み書き。
   Configは設定画面自身のため非表示対象に含めない。 */

export const NAV_VISIBILITY_KEY = 'site-nav-visibility';

export interface NavPage {
  href: string;
  label: string;
  icon: string;
}

export const NAV_PAGES: NavPage[] = [
  { href: '/kotlin-rev/', label: '逆引きKotlin', icon: '📖' },
  { href: '/docs/', label: 'MEMO', icon: '📝' },
  { href: '/feeds/', label: 'Feeds', icon: '📰' },
  { href: '/toolkit/', label: 'Toolkit', icon: '🧰' },
  { href: '/transient/', label: 'Transient', icon: '🗒️' },
  { href: '/defrag/', label: 'Defrag', icon: '🧩' },
  { href: '/diary/', label: 'Diary', icon: '📔' },
];

export function loadHiddenNav(storage: Storage): string[] {
  try {
    const raw = storage.getItem(NAV_VISIBILITY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function saveHiddenNav(storage: Storage, hidden: string[]): void {
  storage.setItem(NAV_VISIBILITY_KEY, JSON.stringify(hidden));
}

export function toggleHiddenNav(hidden: string[], href: string): string[] {
  return hidden.includes(href) ? hidden.filter((h) => h !== href) : [...hidden, href];
}
