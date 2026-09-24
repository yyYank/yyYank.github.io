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
      className="px-2 py-1 text-xs rounded bg-surface-2 hover:bg-accent-soft text-muted hover:text-accent transition-colors"
      title="Copy to clipboard"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}
