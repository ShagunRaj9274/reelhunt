import { Link } from 'react-router';
import { WishlistButton } from './WishlistButton';
import { Rating } from './Rating';

/**
 * The one bold moment on the page: this week's most-talked-about film,
 * full-bleed, like the lobby poster of a cinema.
 */
export function Hero({ movie }) {
  if (!movie?.backdrop) return null;
  return (
    <section className="hero" aria-label="Featured this week">
      <picture className="hero__bg">
        <source media="(min-width: 800px)" srcSet={movie.backdrop.lg} />
        <img src={movie.backdrop.sm} alt="" fetchPriority="high" decoding="async" />
      </picture>
      <div className="hero__content">
        <p className="hero__kicker">Most watched this week</p>
        <h1 className="hero__title">{movie.title}</h1>
        <div className="hero__meta">
          {movie.year && <span>{movie.year}</span>}
          <Rating value={movie.rating} />
        </div>
        {movie.overview && <p className="hero__overview">{movie.overview}</p>}
        <div className="hero__actions">
          <Link to={`/movie/${movie.id}`} state={{ preview: movie }} className="btn btn--primary">
            See details
          </Link>
          <WishlistButton movie={movie} variant="full" />
        </div>
      </div>
    </section>
  );
}
