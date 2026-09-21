import { useEffect, useRef, useState } from 'react';

/** Tracks whether an element is within `rootMargin` of the viewport. */
export function useInView({ rootMargin = '0px', disabled = false } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || disabled || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin, disabled]);

  return [ref, inView];
}
