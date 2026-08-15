import { useMemo, useState } from "react";
import type { BundleItem } from "../types";
import { useCopy } from "./useCopy";

export function BundleExport({ bundle }: { bundle: BundleItem }) {
  const initial = useMemo(() => {
    const head = bundle.title ? bundle.title + "\n\n" : "";
    return head + bundle.children.map((c) => c.text).join("\n\n");
  }, [bundle]);
  const [text, setText] = useState(initial);
  const { done, copy, ref } = useCopy(text);
  return (
    <>
      <div className="dfg-sbody">
        <textarea ref={ref} className="dfg-out" value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="dfg-sfoot">
        <span className="dfg-grow" />
        <button className="dfg-btn" data-key="1" onClick={copy}>{done ? "コピーした" : "コピー"}</button>
      </div>
    </>
  );
}
