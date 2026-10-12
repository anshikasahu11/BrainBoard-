"use client";

import { motion, useReducedMotion } from "motion/react";
import { ease, levels } from "@/lib/motion";

// Fades and rises its children into place.
// level:  "subtle" | "balanced" | "expressive"
// delay:  seconds, for staggering several Reveals in sequence
// inView: wait until the element scrolls into view (plays once)
export default function Reveal({
  children,
  level = "balanced",
  delay = 0,
  as = "div",
  className,
  inView = false,
}) {
  const reduceMotion = useReducedMotion();
  const config = levels[level] ?? levels.balanced;
  const Component = motion[as];
  const target = { opacity: 1, y: 0 };

  return (
    <Component
      className={className}
      // If the user prefers reduced motion, skip the animation entirely.
      initial={reduceMotion ? false : { opacity: 0, y: config.distance }}
      {...(inView
        ? {
            whileInView: target,
            viewport: { once: true, margin: "0px 0px -80px 0px" },
          }
        : { animate: target })}
      transition={{
        duration: config.duration,
        delay: (config.baseDelay ?? 0) + delay * config.delayScale,
        ease: ease.out,
      }}
    >
      {children}
    </Component>
  );
}