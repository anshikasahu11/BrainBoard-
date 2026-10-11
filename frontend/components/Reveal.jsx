"use client";

import { motion, useReducedMotion } from "motion/react";
import { ease, levels } from "@/lib/motion";

// Fades and rises its children into place.
// level: "subtle" | "balanced" | "expressive"
// delay: seconds, for staggering several Reveals in sequence
export default function Reveal({
  children,
  level = "balanced",
  delay = 0,
  as = "div",
  className,
}) {
  const reduceMotion = useReducedMotion();
  const config = levels[level] ?? levels.balanced;
  const Component = motion[as];

  return (
    <Component
      className={className}
      // If the user prefers reduced motion, skip the animation entirely.
      initial={reduceMotion ? false : { opacity: 0, y: config.distance }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: config.duration,
        delay: delay * config.delayScale,
        ease: ease.out,
      }}
    >
      {children}
    </Component>
  );
}