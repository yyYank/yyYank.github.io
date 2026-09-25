import { useState } from 'react';

interface CopyButtonProps {
  text: string;
}

export default function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={`px-2 py-1 text-xs rounded transition duration-fast ease-ui active:scale-95 ${
        copied ? 'bg-accent-soft text-accent' : 'bg-surface-2 hover:bg-accent-soft text-muted hover:text-accent'
      }`}
      title="Copy to clipboard"
    >
      {copied ? <span className="fx-pop">コピーしました</span> : 'Copy'}
    </button>
  );
}
