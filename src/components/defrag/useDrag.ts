import { useRef } from "react";
import type React from "react";

/* ジェスチャの調停(静止0.2秒で掴む / 横に払えばスワイプ / 縦はスクロール)だけを
   共通化する。掴んだ後のドロップ判定は画面ごとに事情が異なるため、
   コールバック注入で呼び出し側に残す。 */

interface Hold<T> {
  target: T;
  x: number;
  y: number;
  el: HTMLElement;
  pid: number;
  mode: null | "drag" | "swipe" | "scroll";
  timer?: ReturnType<typeof setTimeout>;
}

export interface UseDragOptions<T> {
  holdMs?: number;
  /* 掴みを諦めて他ジェスチャへ譲る移動量。Wallはスワイプが無いぶん横も9pxで譲る */
  cancelX?: number;
  cancelY?: number;
  isDragging: () => boolean;
  onHold: (target: T, el: HTMLElement, point: { x: number; y: number }) => void;
  onDragMove: (e: React.PointerEvent) => void;
  onDragEnd: () => void;
  swipe?: {
    canSwipe: (target: T) => boolean;
    onSwipeMove: (target: T, dx: number) => void;
    onSwipeEnd: (target: T, el: HTMLElement) => void;
  };
}

export function useDrag<T>(options: UseDragOptions<T>) {
  const hold = useRef<Hold<T> | null>(null);
  const suppress = useRef(false);

  const down = (e: React.PointerEvent, target: T) => {
    hold.current = {
      target, x: e.clientX, y: e.clientY,
      el: e.currentTarget as HTMLElement, pid: e.pointerId, mode: null,
    };
    hold.current.timer = setTimeout(() => {
      const h = hold.current;
      if (!h || h.mode) return;
      h.mode = "drag";
      suppress.current = true;
      try { h.el.setPointerCapture(h.pid); } catch (err) {}
      options.onHold(h.target, h.el, { x: h.x, y: h.y });
    }, options.holdMs ?? 200);
  };

  const move = (e: React.PointerEvent) => {
    if (options.isDragging()) { options.onDragMove(e); return; }
    const h = hold.current;
    if (!h) return;
    const dx = e.clientX - h.x;
    const dy = e.clientY - h.y;
    const cx = options.cancelX ?? 12;
    const cy = options.cancelY ?? 9;
    if (!h.mode) {
      if (options.swipe && options.swipe.canSwipe(h.target) && Math.abs(dx) > cx && Math.abs(dx) > Math.abs(dy)) {
        h.mode = "swipe";
        clearTimeout(h.timer);
        suppress.current = true;
        try { h.el.setPointerCapture(h.pid); } catch (err) {}
      } else if (Math.abs(dx) > cx || Math.abs(dy) > cy) {
        h.mode = "scroll";
        clearTimeout(h.timer);
        hold.current = null;
      }
      return;
    }
    if (h.mode === "swipe" && options.swipe) {
      e.preventDefault();
      options.swipe.onSwipeMove(h.target, dx);
    }
  };

  const up = () => {
    if (options.isDragging()) { options.onDragEnd(); hold.current = null; return; }
    const h = hold.current;
    hold.current = null;
    if (!h) return;
    clearTimeout(h.timer);
    if (h.mode === "swipe" && options.swipe) options.swipe.onSwipeEnd(h.target, h.el);
  };

  /* ドラッグやスワイプの直後のclickを1回だけ握りつぶす */
  const tapped = (fn: () => void) => () => {
    if (suppress.current) { suppress.current = false; return; }
    fn();
  };

  return { down, move, up, tapped, holdRef: hold };
}
