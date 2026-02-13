'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { ReactNode } from 'react';
import { useState, useEffect, useMemo } from 'react';

interface FadeInProps {
  children: ReactNode;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  className?: string;
}

export function FadeIn({ children, delay = 0, direction = 'up', className = '' }: FadeInProps) {
  const directionOffset = {
    up: { y: 40, x: 0 },
    down: { y: -40, x: 0 },
    left: { y: 0, x: 40 },
    right: { y: 0, x: -40 },
  };

  return (
    <motion.div
      initial={{ opacity: 0, ...directionOffset[direction] }}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface StaggerContainerProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}

export function StaggerContainer({ children, className = '', staggerDelay = 0.1 }: StaggerContainerProps) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-50px' }}
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface StaggerItemProps {
  children: ReactNode;
  className?: string;
}

export function StaggerItem({ children, className = '' }: StaggerItemProps) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 30, scale: 0.95 },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: {
            duration: 0.5,
            ease: [0.22, 1, 0.36, 1],
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface ScaleInProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export function ScaleIn({ children, delay = 0, className = '' }: ScaleInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface HoverCardProps {
  children: ReactNode;
  className?: string;
}

export function HoverCard({ children, className = '' }: HoverCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface TextSwitchAnimationProps {
  firstText: string;
  secondText: string;
  className?: string;
  duration?: number;
  typingSequence?: string[];
  typingStepDuration?: number;
  typingHoldDuration?: number;
  secondTypingSequence?: string[];
  secondTypingStepDuration?: number;
  secondTypingStartDelay?: number;
}

export function TextSwitchAnimation({
  firstText,
  secondText,
  className = '',
  duration = 1,
  typingSequence,
  typingStepDuration = 0.25,
  typingHoldDuration,
  secondTypingSequence,
  secondTypingStepDuration = 0.2,
  secondTypingStartDelay = 0
}: TextSwitchAnimationProps) {
  const firstSteps = useMemo(
    () => (typingSequence && typingSequence.length > 0 ? typingSequence : [firstText]),
    [typingSequence, firstText]
  );
  const secondSteps = useMemo(
    () => (secondTypingSequence && secondTypingSequence.length > 0 ? secondTypingSequence : [secondText]),
    [secondTypingSequence, secondText]
  );
  const holdDuration = typingHoldDuration ?? duration;
  const [showFirst, setShowFirst] = useState(true);
  const [currentFirstText, setCurrentFirstText] = useState(firstSteps[0] ?? firstText);
  const [currentSecondText, setCurrentSecondText] = useState(secondSteps[0] ?? secondText);

  useEffect(() => {
    setShowFirst(true);
    setCurrentFirstText(firstSteps[0] ?? firstText);
    setCurrentSecondText(secondSteps[0] ?? secondText);

    const timers: ReturnType<typeof setTimeout>[] = [];

    firstSteps.forEach((text, index) => {
      const stepTimer = setTimeout(() => {
        setCurrentFirstText(text);
      }, index * typingStepDuration * 1000);
      timers.push(stepTimer);
    });

    const switchDelay = (firstSteps.length - 1) * typingStepDuration * 1000 + holdDuration * 1000;
    const switchTimer = setTimeout(() => {
      setShowFirst(false);
    }, switchDelay);
    timers.push(switchTimer);

    secondSteps.forEach((text, index) => {
      const stepTimer = setTimeout(() => {
        setCurrentSecondText(text);
      }, switchDelay + (secondTypingStartDelay + index * secondTypingStepDuration) * 1000);
      timers.push(stepTimer);
    });

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [
    firstText,
    secondText,
    firstSteps,
    secondSteps,
    typingStepDuration,
    holdDuration,
    secondTypingStepDuration,
    secondTypingStartDelay
  ]);

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <AnimatePresence mode="wait" initial={false}>
        {showFirst ? (
          <motion.span
            key="first"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration }}
            className={className}
            style={{ display: 'inline-block' }}
          >
            {currentFirstText}
          </motion.span>
        ) : (
          <motion.span
            key="second"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: duration }}
            className={className}
            style={{ display: 'inline-block' }}
          >
            {currentSecondText}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
