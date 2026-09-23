import { useState } from 'react';

export default function CharCount() {
  const [text, setText] = useState('');

  return (
    <div>
      <div className="mb-4 font-mono text-4xl text-accent">
        {text.length}<span className="text-lg text-faint ml-2">文字</span>
      </div>
      <textarea
        value={text}
        onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
        placeholder="ここに入力..."
        className="w-full h-80 bg-surface-2 border border-border rounded-lg p-4 text-text font-mono text-sm resize-y focus:border-accent/50 focus:outline-none transition-colors"
      />
    </div>
  );
}
