"use client";

import { useEffect, useState } from "react";

// Returns `value`, but only after it has stopped changing for `delay` ms.
// Used so a search box sends one request when you pause, not one per keystroke.
export default function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}