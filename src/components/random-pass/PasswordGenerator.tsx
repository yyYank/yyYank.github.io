import { useState, useCallback, useEffect } from 'react';

const CHARS_ALPHA = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const CHARS_DIGITS = '0123456789';
const CHARS_SYMBOLS = '!@#$%^&*_+-=?';

function generate(length: number, alpha: boolean, digits: boolean, symbols: boolean): string {
  let pool = '';
  if (alpha) pool += CHARS_ALPHA;
  if (digits) pool += CHARS_DIGITS;
  if (symbols) pool += CHARS_SYMBOLS;
  if (!pool) return '';

  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (v) => pool[v % pool.length]).join('');
}

export default function PasswordGenerator() {
  const [length, setLength] = useState(16);
  const [alpha, setAlpha] = useState(true);
  const [digits, setDigits] = useState(true);
  const [symbols, setSymbols] = useState(false);
  const [passwords, setPasswords] = useState<string[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [generation, setGeneration] = useState(0);

  const handleGenerate = useCallback(() => {
    const results: string[] = [];
    for (let i = 0; i < 10; i++) {
      results.push(generate(length, alpha, digits, symbols));
    }
    setPasswords(results);
    setGeneration((g) => g + 1);
    setCopiedIdx(null);
  }, [length, alpha, digits, symbols]);

  // 設定を変えたらその場で作り直す
  useEffect(() => {
    handleGenerate();
  }, [handleGenerate]);

  const handleCopy = useCallback((pw: string, idx: number) => {
    navigator.clipboard.writeText(pw).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    });
  }, []);

  const hasPool = alpha || digits || symbols;

  return (
    <div>
      {/* Settings */}
      <div className="flex flex-wrap items-center gap-6 pb-4 border-b border-border">
        <label className="flex items-center gap-2 text-sm text-muted">
          <span>文字数</span>
          <input
            type="number"
            min={4}
            max={128}
            value={length}
            onChange={(e) => setLength(Math.max(4, Math.min(128, Number(e.target.value) || 4)))}
            className="w-16 bg-transparent border-b border-border-strong px-1 py-0.5 text-text text-center font-mono outline-none focus:border-accent transition-colors duration-fast ease-ui"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={alpha}
            onChange={(e) => setAlpha(e.target.checked)}
            className="accent-accent-cyan w-4 h-4"
          />
          半角英字
        </label>

        <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={digits}
            onChange={(e) => setDigits(e.target.checked)}
            className="accent-accent-cyan w-4 h-4"
          />
          数字
        </label>

        <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={symbols}
            onChange={(e) => setSymbols(e.target.checked)}
            className="accent-accent-cyan w-4 h-4"
          />
          記号
        </label>

        <button
          onClick={handleGenerate}
          disabled={!hasPool}
          className="ml-auto text-sm text-muted hover:text-accent transition duration-fast ease-ui active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          作り直す
        </button>
      </div>

      {/* Results */}
      {hasPool && passwords.length > 0 && (
        <ul className="divide-y divide-border">
          {passwords.map((pw, i) => (
            <li
              key={`${generation}-${i}`}
              className="fx-enter flex items-center gap-3 py-3 group"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <code className="flex-1 font-mono text-sm text-text break-all select-all">
                {pw}
              </code>
              <button
                onClick={() => handleCopy(pw, i)}
                className={`shrink-0 px-2 py-1 text-xs rounded transition duration-fast ease-ui active:scale-95 ${
                  copiedIdx === i
                    ? 'text-accent'
                    : 'text-faint group-hover:text-muted hover:text-text'
                }`}
              >
                {copiedIdx === i ? <span key="copied" className="fx-pop">コピーしました</span> : 'Copy'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
