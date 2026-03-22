import { motion } from 'framer-motion';

const celebratoryLaunchers = [
  { id: 'left-bottom-inner', side: 'left', edge: 'bottom', anchor: 42, offset: '20%', x: 150, y: -226, drift: 264, sway: 36, rotate: 184, delay: 0.22 },
  { id: 'left-bottom-far', side: 'left', edge: 'bottom', anchor: -10, offset: '12%', x: 122, y: -182, drift: 252, sway: 30, rotate: 136, delay: 0.3 },
  { id: 'right-bottom-inner', side: 'right', edge: 'bottom', anchor: 42, offset: '20%', x: -150, y: -226, drift: 264, sway: -36, rotate: -184, delay: 0.22 },
  { id: 'right-bottom-far', side: 'right', edge: 'bottom', anchor: -10, offset: '12%', x: -122, y: -182, drift: 252, sway: -30, rotate: -136, delay: 0.3 },
] as const;

const celebratoryVariants = [
  { suffix: 'a', color: 'bg-amber-300', size: 'h-2 w-2', dx: 0, dy: 0, drift: 0, sway: 0, rotate: 0, delay: 0 },
  { suffix: 'b', color: 'bg-emerald-300', size: 'h-2.5 w-1.5', dx: 18, dy: -18, drift: 18, sway: 8, rotate: 36, delay: 0.08 },
  { suffix: 'c', color: 'bg-sky-300', size: 'h-1.5 w-4', dx: -14, dy: -34, drift: 36, sway: -6, rotate: -32, delay: 0.14 },
  { suffix: 'd', color: 'bg-rose-300', size: 'h-3.5 w-1.5', dx: 10, dy: -8, drift: 28, sway: 12, rotate: 58, delay: 0.05 },
  { suffix: 'e', color: 'bg-fuchsia-300', size: 'h-1.5 w-6', dx: -22, dy: -24, drift: 44, sway: -10, rotate: -48, delay: 0.12 },
  { suffix: 'f', color: 'bg-pink-200', size: 'h-1 w-2.5', dx: 24, dy: -40, drift: 52, sway: 6, rotate: 74, delay: 0.18 },
  { suffix: 'g', color: 'bg-rose-200', size: 'h-2 w-5', dx: -30, dy: -10, drift: 62, sway: -14, rotate: -64, delay: 0.04 },
  { suffix: 'h', color: 'bg-cyan-200', size: 'h-4 w-1', dx: 28, dy: -28, drift: 70, sway: 10, rotate: 96, delay: 0.1 },
  { suffix: 'i', color: 'bg-lime-200', size: 'h-1.5 w-3', dx: -8, dy: -46, drift: 58, sway: 4, rotate: 118, delay: 0.16 },
  { suffix: 'j', color: 'bg-white', size: 'h-1 w-1', dx: 34, dy: -14, drift: 48, sway: 16, rotate: -20, delay: 0.2 },
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

function getLauncherRotation(
  side: (typeof celebratoryLaunchers)[number]['side'],
  _edge: (typeof celebratoryLaunchers)[number]['edge']
): number {
  return side === 'left' ? -42 : -138;
}

function getLauncherKick(
  side: (typeof celebratoryLaunchers)[number]['side'],
  _edge: (typeof celebratoryLaunchers)[number]['edge']
): { x: number[]; y: number[] } {
  return side === 'left'
    ? { x: [0, -6, 3, 0], y: [0, 4, -1, 0] }
    : { x: [0, 6, -3, 0], y: [0, 4, -1, 0] };
}

export default function CelebrationConfetti() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {celebratoryLaunchers.map((launcher) => (
        <motion.div
          key={`${launcher.id}-launcher`}
          initial={{ opacity: 0, scale: 0.92, x: 0, y: 0 }}
          animate={{
            opacity: [0, 1, 1, 0.9, 0],
            scale: [0.92, 1.12, 0.96, 1, 0.94],
            x: getLauncherKick(launcher.side, launcher.edge).x,
            y: getLauncherKick(launcher.side, launcher.edge).y,
          }}
          transition={{
            duration: 2.2,
            delay: launcher.delay,
            times: [0, 0.12, 0.2, 0.58, 1],
            ease: [0.2, 0.9, 0.3, 1],
          }}
          className="absolute"
          style={{
            ...(launcher.side === 'left'
              ? { left: `${launcher.anchor - 2}px` }
              : { right: `${launcher.anchor - 2}px` }),
            ...(launcher.edge === 'top' ? { top: launcher.offset } : { bottom: launcher.offset }),
          }}
        >
          <motion.div
            className="relative h-10 w-12 drop-shadow-[0_10px_22px_rgba(0,0,0,0.26)]"
            initial={{ scaleY: 1, scaleX: 1 }}
            animate={{ scaleY: [1, 0.9, 1.02, 1], scaleX: [1, 1.14, 0.98, 1] }}
            transition={{
              duration: 0.56,
              delay: launcher.delay,
              times: [0, 0.24, 0.58, 1],
              ease: [0.24, 1, 0.3, 1],
            }}
            style={{
              transform: `rotate(${getLauncherRotation(launcher.side, launcher.edge)}deg)`,
              transformOrigin: '18% 50%',
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                clipPath: 'polygon(6% 50%, 100% 0%, 100% 100%)',
                background:
                  launcher.edge === 'top'
                    ? 'linear-gradient(135deg, rgba(254,240,138,0.98) 0%, rgba(251,191,36,0.96) 22%, rgba(244,114,182,0.92) 58%, rgba(190,24,93,0.92) 100%)'
                    : 'linear-gradient(135deg, rgba(165,243,252,0.98) 0%, rgba(34,211,238,0.96) 24%, rgba(74,222,128,0.92) 62%, rgba(14,165,233,0.9) 100%)',
              }}
            />
            <div
              className="absolute inset-0 opacity-50"
              style={{
                clipPath: 'polygon(8% 50%, 100% 6%, 100% 18%, 24% 56%)',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0))',
              }}
            />
            <div className="absolute left-[4px] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white/18 blur-[1px]" />
            <div className="absolute right-[1px] top-1/2 h-5 w-[5px] -translate-y-1/2 rounded-r-full border border-white/30 bg-white/26" />
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: [0, 0.9, 0], scale: [0.7, 1.6, 2.1] }}
              transition={{
                duration: 0.42,
                delay: launcher.delay + 0.02,
                times: [0, 0.32, 1],
                ease: [0.24, 1, 0.3, 1],
              }}
              className="absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border border-white/25"
            />
          </motion.div>
        </motion.div>
      ))}

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
