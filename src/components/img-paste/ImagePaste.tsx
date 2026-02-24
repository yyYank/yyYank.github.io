import { useState, useCallback } from 'react';

interface PastedImage {
  dataUrl: string;
  name: string;
  size: number;
  type: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function generateFilename(type: string): string {
  const ext = type.split('/')[1] || 'png';
  const now = new Date();
  const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  return `pasted_${ts}.${ext}`;
}

export default function ImagePaste() {
  const [image, setImage] = useState<PastedImage | null>(null);
  const [filename, setFilename] = useState('');

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (!file) continue;

        const name = generateFilename(file.type);
        const reader = new FileReader();
        reader.onload = () => {
          setImage({
            dataUrl: reader.result as string,
            name,
            size: file.size,
            type: file.type,
          });
          setFilename(name);
        };
        reader.readAsDataURL(file);
        break;
      }
    }
  }, []);

  const handleDownload = useCallback(() => {
    if (!image) return;
    const a = document.createElement('a');
    a.href = image.dataUrl;
    a.download = filename || image.name;
    a.click();
  }, [image, filename]);

  const handleClear = useCallback(() => {
    setImage(null);
    setFilename('');
  }, []);

  return (
    <div onPaste={handlePaste}>
      {/* Paste area */}
      {!image && (
        <div className="border-2 border-dashed border-dark-500 rounded-lg p-16 text-center hover:border-accent-cyan/40 transition-colors">
          <p className="text-gray-400 text-lg mb-2">Ctrl+V / Cmd+V で画像をペースト</p>
          <p className="text-gray-600 text-sm">クリップボードにコピーした画像を貼り付けてください</p>
        </div>
      )}

      {/* Image display */}
      {image && (
        <div>
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <span className="shrink-0">ファイル名</span>
              <input
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                className="bg-dark-700 border border-dark-600 rounded px-3 py-1.5 text-gray-100 font-mono text-sm w-64 focus:border-accent-cyan/50 focus:outline-none"
              />
            </label>
            <button
              onClick={handleDownload}
              className="px-4 py-1.5 bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/40 rounded text-sm font-medium hover:bg-accent-cyan/30 transition-colors"
            >
              Download
            </button>
            <button
              onClick={handleClear}
              className="px-4 py-1.5 bg-dark-700 text-gray-400 border border-dark-600 rounded text-sm hover:text-gray-200 hover:border-dark-500 transition-colors"
            >
              Clear
            </button>
          </div>

          {/* Info */}
          <div className="text-xs text-gray-500 mb-4 font-mono">
            {image.type} / {formatBytes(image.size)}
          </div>

          {/* Image */}
          <div className="bg-dark-700 border border-dark-600 rounded-lg p-4 overflow-auto">
            <img
              src={image.dataUrl}
              alt={filename}
              className="max-w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}
