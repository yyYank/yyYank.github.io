interface DownloadButtonProps {
  blob: Blob | null;
  filename: string;
  disabled?: boolean;
}

export default function DownloadButton({ blob, filename, disabled }: DownloadButtonProps) {
  const handleDownload = () => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleDownload}
      disabled={disabled || !blob}
      className="w-full py-2 px-4 bg-accent-cyan text-dark-900 font-semibold rounded-lg hover:bg-accent-cyan/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      Download {filename}
    </button>
  );
}
