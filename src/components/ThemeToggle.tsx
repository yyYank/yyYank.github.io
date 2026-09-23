import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    setDark(next);
  };

  return (
    <button
      onClick={toggle}
      className="p-2 rounded-lg text-muted hover:text-text hover:bg-surface-2 transition-colors"
      aria-label={dark ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
    >
      {dark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
