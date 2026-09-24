'use client';

import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';

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
    <MotionConfig reducedMotion="user">
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
    </MotionConfig>
  );
}
