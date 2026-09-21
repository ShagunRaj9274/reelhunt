import { memo, useRef } from 'react';
import { Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Poster } from './Poster';
import { Rating } from './Rating';
import { WishlistButton } from './WishlistButton';
import { moviesApi } from '../api/movies';
import { keys } from '../api/queryClient';

/**
 * One movie in a grid or row. Memoised: with hundreds of cards on screen,
 * loading page 12 must not re-render the 220 cards above it.
 *
 * The link and the wishlist button are siblings (not nested) so both are
 * valid, separately focusable controls.
 */
export const MovieCard = memo(function MovieCard({ movie, sizes, priority = false }) {
  const qc = useQueryClient();
  const hoverTimer = useRef();

  // Hovering for a moment usually means "about to click": warm the details cache.
  const prefetch = () => {
    hoverTimer.current = setTimeout(() => {
      qc.prefetchQuery({ queryKey: keys.movie(movie.id), queryFn: ({ signal }) => moviesApi.details(movie.id, signal), staleTime: 10 * 60 * 1000 });
    }, 250);
  };
  const cancel = () => clearTimeout(hoverTimer.current);

  return (
    <article className="card">
      <Link
        to={`/movie/${movie.id}`}
        state={{ preview: movie }}
        className="card__link"
        onMouseEnter={prefetch}
        onMouseLeave={cancel}
        onFocus={prefetch}
        onBlur={cancel}
      >
        <Poster poster={movie.poster} title={movie.title} sizes={sizes} priority={priority} />
        <h3 className="card__title" title={movie.title}>
          {movie.title}
        </h3>
        <p className="card__meta">
          <span>{movie.year ?? 'TBA'}</span>
          <Rating value={movie.rating} />
        </p>
      </Link>
      <div className="card__action">
        <WishlistButton movie={movie} />
      </div>
    </article>
  );
});

export function SkeletonCard() {
  return (
    <div className="card card--skeleton" aria-hidden="true">
      <div className="poster skeleton" />
      <div className="skeleton skeleton--line" />
      <div className="skeleton skeleton--line skeleton--short" />
    </div>
  );
}
