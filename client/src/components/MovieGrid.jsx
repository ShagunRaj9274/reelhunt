import { MovieCard, SkeletonCard } from './MovieCard';

const GRID_SIZES = '(max-width: 480px) 46vw, (max-width: 900px) 30vw, 200px';

export function MovieGrid({ movies, dimmed = false, priorityCount = 6 }) {
  return (
    <ul className={`grid ${dimmed ? 'is-dimmed' : ''}`} aria-busy={dimmed || undefined}>
      {movies.map((m, i) => (
        <li key={m.id} className="grid__item">
          <MovieCard movie={m} sizes={GRID_SIZES} priority={i < priorityCount} />
        </li>
      ))}
    </ul>
  );
}

export function GridSkeleton({ count = 12 }) {
  return (
    <ul className="grid" aria-label="Loading movies">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="grid__item">
          <SkeletonCard />
        </li>
      ))}
    </ul>
  );
}
