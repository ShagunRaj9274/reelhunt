import { useRef } from 'react';
import { MovieCard, SkeletonCard } from './MovieCard';
import { ChevronIcon } from './Icons';

/** Horizontally scrolling shelf (trending, recommendations). Swipe on touch, arrows on desktop. */
export function MovieRow({ title, movies, loading = false, headingLevel = 2 }) {
  const scroller = useRef(null);
  const Heading = `h${headingLevel}`;

  const scrollBy = (dir) => {
    const el = scroller.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  };

  if (!loading && !movies?.length) return null;

  return (
    <section className="row" aria-label={title}>
      <div className="row__head">
        <Heading className="row__title">{title}</Heading>
        <div className="row__arrows">
          <button type="button" className="icon-btn" aria-label={`Scroll ${title} left`} onClick={() => scrollBy(-1)}>
            <ChevronIcon dir="left" />
          </button>
          <button type="button" className="icon-btn" aria-label={`Scroll ${title} right`} onClick={() => scrollBy(1)}>
            <ChevronIcon />
          </button>
        </div>
      </div>
      <ul className="row__track" ref={scroller}>
        {loading
          ? Array.from({ length: 8 }, (_, i) => (
              <li key={i} className="row__item">
                <SkeletonCard />
              </li>
            ))
          : movies.map((m) => (
              <li key={m.id} className="row__item">
                <MovieCard movie={m} sizes="160px" />
              </li>
            ))}
      </ul>
    </section>
  );
}
