import { useState, useCallback } from 'react';

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

  const handleGenerate = useCallback(() => {
    const results: string[] = [];
    for (let i = 0; i < 10; i++) {
      results.push(generate(length, alpha, digits, symbols));
    }
    setPasswords(results);
    setCopiedIdx(null);
  }, [length, alpha, digits, symbols]);

  const handleCopy = useCallback((pw: string, idx: number) => {
    navigator.clipboard.writeText(pw).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    });
  }, []);

  return (
    <div>
      {/* Settings */}
      <div className="bg-dark-700 border border-dark-600 rounded-lg p-6 mb-6">
        <div className="flex flex-wrap items-center gap-6">
          {/* Length */}
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <span>文字数</span>
            <input
              type="number"
              min={4}
              max={128}
              value={length}
              onChange={(e) => setLength(Math.max(4, Math.min(128, Number(e.target.value) || 4)))}
              className="w-20 bg-dark-800 border border-dark-500 rounded px-2 py-1 text-gray-100 text-center font-mono"
            />
          </label>

          {/* Checkboxes */}
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={alpha}
              onChange={(e) => setAlpha(e.target.checked)}
              className="accent-accent-cyan w-4 h-4"
            />
            半角英字
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={digits}
              onChange={(e) => setDigits(e.target.checked)}
              className="accent-accent-cyan w-4 h-4"
            />
            数字
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={symbols}
              onChange={(e) => setSymbols(e.target.checked)}
              className="accent-accent-cyan w-4 h-4"
            />
            記号
          </label>
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={!alpha && !digits && !symbols}
          className="mt-4 px-6 py-2 bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/40 rounded-lg text-sm font-medium hover:bg-accent-cyan/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          生成
        </button>
      </div>

      {/* Results */}
      {passwords.length > 0 && (
        <div className="space-y-2">
          {passwords.map((pw, i) => (
            <div
              key={i}
              className="flex items-center gap-3 bg-dark-700 border border-dark-600 rounded-lg px-4 py-3 group hover:border-accent-cyan/40 transition-colors"
            >
              <code className="flex-1 font-mono text-sm text-gray-100 break-all select-all">
                {pw}
              </code>
              <button
                onClick={() => handleCopy(pw, i)}
                className="shrink-0 px-3 py-1 text-xs rounded border transition-colors bg-dark-600 border-dark-500 text-gray-400 hover:text-gray-100 hover:border-dark-400"
              >
                {copiedIdx === i ? 'Copied!' : 'Copy'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
