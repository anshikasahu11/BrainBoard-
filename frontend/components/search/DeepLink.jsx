"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Only real ids are accepted. A hand-edited address can't make the page do anything odd.
const LOOKS_LIKE_AN_ID = /^[a-f0-9]{24}$/i;

function Reader({ param, onOpen }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const value = searchParams.get(param);

  // The newest onOpen is always the one called, without running the effect again.
  const latest = useRef(onOpen);
  useEffect(() => {
    latest.current = onOpen;
  });

  // The value we already dealt with, so a repeated run (or React's double run in development)
  // can't open the same thing twice.
  const handled = useRef(null);

  useEffect(() => {
    if (!value) {
      handled.current = null;
      return;
    }
    if (handled.current === value) return;
    handled.current = value;

    if (LOOKS_LIKE_AN_ID.test(value)) latest.current(value);

    // Remove it from the address, so a refresh or the Back button doesn't open it again.
    const rest = new URLSearchParams(searchParams.toString());
    rest.delete(param);
    const query = rest.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [value, param, pathname, router, searchParams]);

  return null;
}

// Opens something named in the address, like /tasks?task=<id>. It draws nothing.
//   param:  the name in the address ("task" or "snippet")
//   onOpen: called once with the id
// Reading the address needs a Suspense boundary, so it's included here.
export default function DeepLink({ param, onOpen }) {
  return (
    <Suspense fallback={null}>
      <Reader param={param} onOpen={onOpen} />
    </Suspense>
  );
}