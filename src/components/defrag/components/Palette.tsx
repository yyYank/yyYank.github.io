import { NOTE_COLORS } from "../format";

export function Palette({ value, onPick }: { value?: string; onPick: (id: string) => void }) {
  return (
    <div className="dfg-palette">
      {NOTE_COLORS.map((c) => (
        <button key={c.id} className="dfg-swatch" data-on={(value || "plain") === c.id ? "1" : "0"}
          style={{ background: c.bg, borderTopColor: c.edge }} onClick={() => onPick(c.id)} aria-label={c.id} />
      ))}
    </div>
  );
}
