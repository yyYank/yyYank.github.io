import { motion } from 'framer-motion';

const celebratoryLaunchers = [
  { id: 'left-bottom-inner', side: 'left', edge: 'bottom', anchor: 42, offset: '20%', x: 150, y: -226, drift: 264, sway: 36, rotate: 184, delay: 0.22 },
  { id: 'left-bottom-mid', side: 'left', edge: 'bottom', anchor: 16, offset: '16%', x: 136, y: -204, drift: 258, sway: 32, rotate: 160, delay: 0.26 },
  { id: 'left-bottom-far', side: 'left', edge: 'bottom', anchor: -10, offset: '12%', x: 122, y: -182, drift: 252, sway: 30, rotate: 136, delay: 0.3 },
  { id: 'right-bottom-inner', side: 'right', edge: 'bottom', anchor: 42, offset: '20%', x: -150, y: -226, drift: 264, sway: -36, rotate: -184, delay: 0.22 },
  { id: 'right-bottom-mid', side: 'right', edge: 'bottom', anchor: 16, offset: '16%', x: -136, y: -204, drift: 258, sway: -32, rotate: -160, delay: 0.26 },
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
  return side === 'left' ? -72 : -108;
}

function getLauncherKick(
  side: (typeof celebratoryLaunchers)[number]['side'],
  _edge: (typeof celebratoryLaunchers)[number]['edge']
): { x: number[]; y: number[] } {
  return side === 'left'
    ? { x: [0, -6, 3, 0], y: [0, 4, -1, 0] }
    : { x: [0, 6, -3, 0], y: [0, 4, -1, 0] };
}

function PartyPopperSvg({ side }: { side: (typeof celebratoryLaunchers)[number]['side'] }) {
  const bodyGradientId = `popper-body-${side}`;
  const shineGradientId = `popper-shine-${side}`;
  const flareGradientId = `popper-flare-${side}`;
  const mouthX = side === 'left' ? 47 : 13;

  return (
    <svg viewBox="0 0 60 44" className="absolute inset-0 h-full w-full overflow-visible">
      <defs>
        <linearGradient id={bodyGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={side === 'left' ? '#a5f3fc' : '#fde68a'} />
          <stop offset="30%" stopColor={side === 'left' ? '#22d3ee' : '#f472b6'} />
          <stop offset="72%" stopColor={side === 'left' ? '#4ade80' : '#fb7185'} />
          <stop offset="100%" stopColor={side === 'left' ? '#0ea5e9' : '#be185d'} />
        </linearGradient>
        <linearGradient id={shineGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.72)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <radialGradient id={flareGradientId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>

      <path
        d={side === 'left' ? 'M9 22 L47 7 Q52 22 47 37 Z' : 'M51 22 L13 7 Q8 22 13 37 Z'}
        fill={`url(#${bodyGradientId})`}
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="1.2"
      />
      <path
        d={side === 'left' ? 'M15 21 L43 11 L31 23 Z' : 'M45 21 L17 11 L29 23 Z'}
        fill={`url(#${shineGradientId})`}
        opacity="0.68"
      />
      <ellipse
        cx={side === 'left' ? '16' : '44'}
        cy="22"
        rx="7.5"
        ry="8.5"
        fill="rgba(255,255,255,0.12)"
      />
      <rect
        x={side === 'left' ? '45.5' : '10.5'}
        y="17.4"
        width="7"
        height="9.2"
        rx="3.4"
        fill="rgba(255,255,255,0.22)"
        stroke="rgba(255,255,255,0.34)"
        strokeWidth="0.9"
      />
      <path
        d={side === 'left' ? 'M39 12 L44 8' : 'M21 12 L16 8'}
        stroke="rgba(255,255,255,0.5)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx={mouthX} cy="22" r="7.5" fill={`url(#${flareGradientId})`} opacity="0.42" />
    </svg>
  );
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
              transformOrigin: '50% 50%',
            }}
          >
            <PartyPopperSvg side={launcher.side} />
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: [0, 0.9, 0], scale: [0.7, 1.6, 2.1] }}
              transition={{
                duration: 0.42,
                delay: launcher.delay + 0.02,
                times: [0, 0.32, 1],
                ease: [0.24, 1, 0.3, 1],
              }}
              className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border border-white/25"
              style={launcher.side === 'left' ? { right: '-2px' } : { left: '-2px' }}
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
