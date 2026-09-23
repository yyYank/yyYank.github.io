import { useEffect, useState } from 'react';
import { NAV_PAGES, loadHiddenNav, saveHiddenNav, toggleHiddenNav } from '../../lib/navVisibility';

export default function NavVisibility() {
  const [hidden, setHidden] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setHidden(loadHiddenNav(localStorage));
    setReady(true);
  }, []);

  const toggle = (href: string) => {
    setHidden((current) => {
      const next = toggleHiddenNav(current, href);
      saveHiddenNav(localStorage, next);
      return next;
    });
  };

  return (
    <div className="bg-surface-2 border border-border rounded-lg p-6">
      <h2 className="text-xl font-bold text-text mb-2">メニュー表示設定</h2>
      <p className="text-muted text-sm mb-4">
        チェックを外したページはメニューとトップから非表示になります(反映はページ再読み込み後)。
      </p>
      <ul className="space-y-2">
        {NAV_PAGES.map((page) => (
          <li key={page.href}>
            <label className="flex items-center gap-3 rounded-lg border border-border bg-surface/60 px-4 py-3 cursor-pointer hover:border-border-strong transition-colors">
              <input
                type="checkbox"
                checked={ready && !hidden.includes(page.href)}
                onChange={() => toggle(page.href)}
                className="h-4 w-4 accent-accent-cyan"
              />
              <span className="text-lg">{page.icon}</span>
              <span className="text-text">{page.label}</span>
              <span className="ml-auto text-xs text-faint font-mono">{page.href}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
