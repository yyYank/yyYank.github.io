import { motion } from 'framer-motion';

const celebratoryLaunchers = [
  { id: 'left-top-outer', side: 'left', edge: 'top', anchor: 6, offset: '14%', x: 116, y: -72, drift: 920, sway: 34, rotate: 210, delay: 0.02 },
  { id: 'left-top-inner', side: 'left', edge: 'top', anchor: 44, offset: '22%', x: 132, y: -26, drift: 948, sway: 42, rotate: 160, delay: 0.08 },
  { id: 'left-top-mid', side: 'left', edge: 'top', anchor: 82, offset: '10%', x: 126, y: -86, drift: 976, sway: 38, rotate: 248, delay: 0.14 },
  { id: 'right-top-outer', side: 'right', edge: 'top', anchor: 6, offset: '14%', x: -116, y: -72, drift: 920, sway: -34, rotate: -210, delay: 0.02 },
  { id: 'right-top-inner', side: 'right', edge: 'top', anchor: 44, offset: '22%', x: -132, y: -26, drift: 948, sway: -42, rotate: -160, delay: 0.08 },
  { id: 'right-top-mid', side: 'right', edge: 'top', anchor: 82, offset: '10%', x: -126, y: -86, drift: 976, sway: -38, rotate: -248, delay: 0.14 },
  { id: 'left-bottom-outer', side: 'left', edge: 'bottom', anchor: 6, offset: '14%', x: 114, y: -178, drift: 248, sway: 28, rotate: 132, delay: 0.18 },
  { id: 'left-bottom-inner', side: 'left', edge: 'bottom', anchor: 44, offset: '22%', x: 148, y: -224, drift: 264, sway: 34, rotate: 184, delay: 0.24 },
  { id: 'left-bottom-mid', side: 'left', edge: 'bottom', anchor: 82, offset: '8%', x: 128, y: -198, drift: 278, sway: 30, rotate: 228, delay: 0.3 },
  { id: 'right-bottom-outer', side: 'right', edge: 'bottom', anchor: 6, offset: '14%', x: -114, y: -178, drift: 248, sway: -28, rotate: -132, delay: 0.18 },
  { id: 'right-bottom-inner', side: 'right', edge: 'bottom', anchor: 44, offset: '22%', x: -148, y: -224, drift: 264, sway: -34, rotate: -184, delay: 0.24 },
  { id: 'right-bottom-mid', side: 'right', edge: 'bottom', anchor: 82, offset: '8%', x: -128, y: -198, drift: 278, sway: -30, rotate: -228, delay: 0.3 },
] as const;

const celebratoryVariants = [
  { suffix: 'a', color: 'bg-amber-300', size: 'h-2 w-2', dx: 0, dy: 0, drift: 0, sway: 0, rotate: 0, delay: 0 },
  { suffix: 'b', color: 'bg-emerald-300', size: 'h-2.5 w-1.5', dx: 18, dy: -18, drift: 18, sway: 8, rotate: 36, delay: 0.08 },
  { suffix: 'c', color: 'bg-sky-300', size: 'h-1.5 w-4', dx: -14, dy: -34, drift: 36, sway: -6, rotate: -32, delay: 0.14 },
] as const;

const celebratoryBursts = celebratoryLaunchers.flatMap((launcher) =>
  celebratoryVariants.map((variant) => ({
    id: `${launcher.id}-${variant.suffix}`,
    side: launcher.side,
    edge: launcher.edge,
    anchor: launcher.anchor,
    offset: launcher.offset,
    color: variant.color,
    size: variant.size,
    x: launcher.x + (launcher.side === 'left' ? variant.dx : -variant.dx),
    y: launcher.y + variant.dy,
    drift: launcher.drift + variant.drift,
    sway: launcher.sway + variant.sway,
    rotate: launcher.rotate + variant.rotate,
    delay: launcher.delay + variant.delay,
  }))
);

export default function CelebrationConfetti() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {celebratoryBursts.map((burst) => (
        <motion.span
          key={burst.id}
          initial={{
            opacity: 0,
            x: 0,
            y: 0,
            rotate: 0,
            scale: 0.6,
          }}
          animate={{
            opacity: [0, 1, 1, 0.88, 0],
            x: [
              0,
              burst.x * 0.85,
              burst.x + burst.sway,
              burst.x - burst.sway * 0.7,
              burst.x + burst.sway * 0.35,
            ],
            y: [0, burst.y * 0.72, burst.y * 0.9, burst.drift * 0.38, burst.drift],
            rotate: [
              0,
              burst.rotate * 0.45,
              burst.rotate,
              burst.rotate * 1.55,
              burst.rotate * 2.1,
            ],
            scale: [0.6, 1, 0.96, 0.9],
          }}
          transition={{
            duration: 8,
            delay: burst.delay,
            times: [0, 0.04, 0.1, 0.9, 1],
            ease: [0.18, 0.9, 0.24, 1],
          }}
          className={`absolute ${burst.size} ${burst.color} rounded-sm shadow-[0_0_18px_rgba(255,255,255,0.12)]`}
          style={{
            ...(burst.side === 'left' ? { left: `${burst.anchor}px` } : { right: `${burst.anchor}px` }),
            ...(burst.edge === 'top' ? { top: burst.offset } : { bottom: burst.offset }),
          }}
        />
      ))}
    </div>
  );
}
