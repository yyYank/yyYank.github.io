import { useEffect, useRef, useState } from "react";
import { Sheet } from "./Sheet";

export function NewFolder({ parentName, onClose, onCreate }: {
  parentName?: string | null; onClose: () => void; onCreate: (title: string) => void;
}) {
  const [v, setV] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.focus(); }, []);
  return (
    <Sheet title={parentName ? `${parentName} の下に` : "フォルダを作る"} onClose={onClose}>
      <div className="dfg-sbody">
        <input ref={ref} className="dfg-titleinput" value={v} placeholder="フォルダ名"
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && v.trim()) onCreate(v); }} />
      </div>
      <div className="dfg-sfoot">
        <span className="dfg-grow" />
        <button className="dfg-btn" data-key="1" onClick={() => onCreate(v)} disabled={!v.trim()}>作る</button>
      </div>
    </Sheet>
  );
}
