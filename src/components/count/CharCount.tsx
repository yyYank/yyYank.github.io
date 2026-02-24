import { useState } from 'react';

export default function CharCount() {
  const [text, setText] = useState('');

  return (
    <div>
      <div className="mb-4 font-mono text-4xl text-accent-cyan">
        {text.length}<span className="text-lg text-gray-500 ml-2">文字</span>
      </div>
      <textarea
        value={text}
        onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
        placeholder="ここに入力..."
        className="w-full h-80 bg-dark-700 border border-dark-600 rounded-lg p-4 text-gray-100 font-mono text-sm resize-y focus:border-accent-cyan/50 focus:outline-none transition-colors"
      />
    </div>
  );
}
