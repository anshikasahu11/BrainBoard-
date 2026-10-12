"use client";

import { useEffect } from "react";

// Tracks the mouse and publishes its position as CSS variables --mx and --my
// (each from -1 to 1) on the page's [data-motion] wrapper.
// Elements opt in with CSS. This component renders nothing.
export default function Parallax() {
  useEffect(() => {
    const hasMouse = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!hasMouse || reduceMotion) return;

    const root = document.querySelector("[data-motion]");
    if (!root) return;

    let frame = 0;

    function onMove(event) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        root.style.setProperty("--mx", ((event.clientX / window.innerWidth) * 2 - 1).toFixed(3));
        root.style.setProperty("--my", ((event.clientY / window.innerHeight) * 2 - 1).toFixed(3));
      });
    }

    function onLeave() {
      root.style.setProperty("--mx", "0");
      root.style.setProperty("--my", "0");
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      root.style.removeProperty("--mx");
      root.style.removeProperty("--my");
    };
  }, []);

  return null;
}