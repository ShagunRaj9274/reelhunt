import { useState } from 'react';

/**
 * Poster with a fixed 2:3 box, so the grid never jumps no matter what size
 * (or shape) the real image is. Missing or broken images fall back to a
 * typographic placeholder with the title.
 */
export function Poster({ poster, title, sizes = '(max-width: 600px) 45vw, 200px', priority = false, className = '' }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!poster || failed) {
    return (
      <div className={`poster poster--empty ${className}`} role="img" aria-label={`No poster available for ${title}`}>
        <span className="poster__fallback-title">{title}</span>
      </div>
    );
  }

  return (
    <div className={`poster ${loaded ? 'is-loaded' : ''} ${className}`}>
      <img
        src={poster.md}
        srcSet={`${poster.sm} 185w, ${poster.md} 342w, ${poster.lg} 500w${poster.xl ? `, ${poster.xl} 780w` : ''}`}
        sizes={sizes}
        alt={`Poster for ${title}`}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
