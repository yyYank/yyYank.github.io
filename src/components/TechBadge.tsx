'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';

interface MascotConfig {
  name: string;
  image: string;
  alt: string;
  color: string;
}

const mascotMap: Record<string, MascotConfig> = {
  Java: {
    name: 'Duke',
    image: '/images/mascots/duke.svg',
    alt: 'Duke - Java mascot',
    color: '#f89820',
  },
  Kotlin: {
    name: 'Kodee',
    image: '/images/mascots/kodee.svg',
    alt: 'Kodee - Kotlin mascot',
    color: '#7F52FF',
  },
  Go: {
    name: 'Gopher',
    image: '/images/mascots/gopher.svg',
    alt: 'Gopher - Go mascot',
    color: '#00ADD8',
  },
  Rust: {
    name: 'Ferris',
    image: '/images/mascots/ferris.svg',
    alt: 'Ferris - Rust mascot',
    color: '#DEA584',
  },
};

interface TechBadgeProps {
  tech: string;
}

export function TechBadge({ tech }: TechBadgeProps) {
  const [showMascot, setShowMascot] = useState(false);
  const mascot = mascotMap[tech];

  const handleClick = useCallback(() => {
    if (mascot) {
      setShowMascot(true);
    }
  }, [mascot]);

  useEffect(() => {
    if (showMascot) {
      const timer = setTimeout(() => {
        setShowMascot(false);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [showMascot]);

  return (
    <div className="relative inline-block">
      <motion.span
        onClick={handleClick}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`px-4 py-2 bg-dark-700 border border-dark-500 rounded-full text-accent-cyan font-mono text-sm inline-block ${mascot ? 'cursor-pointer' : ''}`}
        style={mascot ? { borderColor: `${mascot.color}40` } : undefined}
      >
        {tech}
      </motion.span>

      <AnimatePresence>
        {showMascot && mascot && (
          <motion.div
            initial={{ opacity: 0, scale: 0, y: 20, rotate: -10 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              rotate: 0,
            }}
            exit={{
              opacity: 0,
              scale: 0.5,
              y: -20,
              rotate: 10,
              transition: { duration: 0.3 }
            }}
            transition={{
              type: 'spring',
              stiffness: 260,
              damping: 20,
              duration: 0.6,
            }}
            className="absolute left-1/2 bottom-full mb-3 -translate-x-1/2 z-50"
          >
            <motion.div
              animate={{
                y: [0, -8, 0],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="relative"
            >
              <div
                className="absolute inset-0 blur-xl rounded-full opacity-50"
                style={{ backgroundColor: mascot.color }}
              />
              <img
                src={mascot.image}
                alt={mascot.alt}
                className="relative w-20 h-20 object-contain drop-shadow-lg"
              />
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap"
              >
                <span
                  className="text-xs font-mono px-2 py-1 rounded-full"
                  style={{
                    backgroundColor: `${mascot.color}20`,
                    color: mascot.color,
                    border: `1px solid ${mascot.color}40`
                  }}
                >
                  {mascot.name}
                </span>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface TechBadgeListProps {
  techs: string[];
}

export function TechBadgeList({ techs }: TechBadgeListProps) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {techs.map((tech) => (
        <TechBadge key={tech} tech={tech} />
      ))}
    </div>
  );
}
