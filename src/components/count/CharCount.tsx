import { useState } from 'react';

export default function CharCount() {
  const [text, setText] = useState('');

  return (
    <div>
      <div className="mb-2 text-right font-mono text-sm text-muted tabular-nums">
        <span key={text.length} className="fx-flip">{text.length}</span><span className="text-xs text-faint ml-1">文字</span>
      </div>
      <textarea
        value={text}
        onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
        placeholder="ここに入力..."
        className="w-full h-80 bg-transparent border-y border-border py-4 text-text text-base leading-8 resize-y placeholder:text-faint focus:border-border-strong focus:outline-none transition-colors duration-fast ease-ui"
      />
    </div>
  );
}
