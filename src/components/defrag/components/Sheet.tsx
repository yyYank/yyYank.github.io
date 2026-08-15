import type React from "react";

export function Sheet({ title, onClose, children }: { title?: string; onClose: () => void; children?: React.ReactNode }) {
  return (
    <>
      <div className="dfg-scrim" onClick={onClose} />
      <div className="dfg-sheet" role="dialog" aria-label={title}>
        <div className="dfg-shead">
          <h2>{title}</h2>
          <button className="dfg-close" onClick={onClose} aria-label="閉じる">✕</button>
        </div>
        {children}
      </div>
    </>
  );
}
