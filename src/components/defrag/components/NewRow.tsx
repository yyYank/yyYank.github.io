import { useEffect, useRef, useState } from "react";
import { FolderIcon } from "./FolderIcon";

export function NewRow({ depth, onCommit, onCancel }: { depth: number; onCommit: (v: string) => void; onCancel: () => void }) {
  const [v, setV] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.focus(); }, []);
  return (
    <div className="dfg-row">
      <div className="dfg-rails">{Array.from({ length: depth }).map((_, k) => <i key={k} />)}</div>
      <span className="dfg-caret" data-empty="1" />
      <div className="dfg-folderbox">
        <span className="dfg-node">
        <FolderIcon />
        <input ref={ref} className="dfg-newname" value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={() => onCommit(v)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommit(v);
            if (e.key === "Escape") onCancel();
          }} />
        </span>
      </div>
    </div>
  );
}
