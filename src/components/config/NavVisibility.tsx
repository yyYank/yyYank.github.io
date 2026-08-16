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
    <div className="bg-dark-700 border border-dark-600 rounded-lg p-6">
      <h2 className="text-xl font-bold text-white mb-2">メニュー表示設定</h2>
      <p className="text-gray-400 text-sm mb-4">
        チェックを外したページはメニューとトップから非表示になります(反映はページ再読み込み後)。
      </p>
      <ul className="space-y-2">
        {NAV_PAGES.map((page) => (
          <li key={page.href}>
            <label className="flex items-center gap-3 rounded-lg border border-dark-600 bg-dark-800/60 px-4 py-3 cursor-pointer hover:border-dark-500 transition-colors">
              <input
                type="checkbox"
                checked={ready && !hidden.includes(page.href)}
                onChange={() => toggle(page.href)}
                className="h-4 w-4 accent-accent-cyan"
              />
              <span className="text-lg">{page.icon}</span>
              <span className="text-gray-200">{page.label}</span>
              <span className="ml-auto text-xs text-gray-500 font-mono">{page.href}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
