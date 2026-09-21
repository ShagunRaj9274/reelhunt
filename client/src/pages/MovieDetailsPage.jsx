import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { moviesApi } from '../api/movies';
import { keys } from '../api/queryClient';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { formatDate, formatMoney, formatRuntime } from '../lib/format';
import { Poster } from '../components/Poster';
import { Rating } from '../components/Rating';
import { WishlistButton } from '../components/WishlistButton';
import { MovieRow } from '../components/MovieRow';
import { TrailerModal } from '../components/TrailerModal';
import { ErrorState, EmptyState, InlineError } from '../components/StatusStates';
import { StaleBanner } from '../components/OfflineBanner';
import { ArrowLeftIcon, PlayIcon } from '../components/Icons';

function BackButton() {
  const navigate = useNavigate();
  // If the user landed here directly (shared link), there is no in-app history to go back to.
  const canGoBack = (window.history.state?.idx ?? 0) > 0;
  return (
    <button type="button" className="back-btn" onClick={() => (canGoBack ? navigate(-1) : navigate('/'))}>
      <ArrowLeftIcon width={18} height={18} />
      {canGoBack ? 'Back' : 'Discover'}
    </button>
  );
}

export default function MovieDetailsPage() {
  const { id } = useParams();
  const location = useLocation();
  const [trailerOpen, setTrailerOpen] = useState(false);
  const validId = /^\d+$/.test(id ?? '');

  const query = useQuery({
    queryKey: keys.movie(id),
    queryFn: ({ signal }) => moviesApi.details(id, signal),
    enabled: validId,
    staleTime: 10 * 60 * 1000,
  });

  // The card we came from already knows title/poster/year: show those instantly
  // while the full details load, instead of a blank page.
  const preview = location.state?.preview?.id === Number(id) ? location.state.preview : null;
  const movie = query.data?.movie ?? preview;
  useDocumentTitle(movie?.title ?? null);

  if (!validId || query.error?.status === 404) {
    return (
      <div className="page-pad">
        <BackButton />
        <EmptyState title="Movie not found" action={<Link to="/" className="btn btn--primary">Browse movies</Link>}>
          <p>It may have been removed from the catalogue, or the link is incorrect.</p>
        </EmptyState>
      </div>
    );
  }

  if (query.isError && !movie) {
    return (
      <div className="page-pad">
        <BackButton />
        <ErrorState title="This movie didn't load" error={query.error} onRetry={() => query.refetch()} />
      </div>
    );
  }

  if (!movie) return <DetailsSkeleton />;

  const full = query.data?.movie;
  const facts = full
    ? [
        ['Released', formatDate(full.releaseDate)],
        ['Directed by', full.directors.join(', ')],
        ['Status', full.status !== 'Released' ? full.status : null],
        ['Languages', full.spokenLanguages.join(', ')],
        ['Countries', full.countries.join(', ')],
        ['Budget', formatMoney(full.budget)],
        ['Box office', formatMoney(full.revenue)],
      ].filter(([, v]) => v)
    : [];

  return (
    <article className="details">
      <div className="details__backdrop" aria-hidden="true">
        {movie.backdrop && <img src={movie.backdrop.lg} alt="" decoding="async" />}
      </div>

      <div className="details__inner page-pad">
        <BackButton />
        {query.data?.stale && <StaleBanner />}

        <div className="details__top">
          <Poster poster={movie.poster} title={movie.title} sizes="(max-width: 700px) 50vw, 320px" priority className="details__poster" />

          <div className="details__info">
            <h1 className="details__title">{movie.title}</h1>
            {full?.originalTitle && full.originalTitle !== full.title && <p className="details__original">{full.originalTitle}</p>}
            {full?.tagline && <p className="details__tagline">{full.tagline}</p>}

            <div className="details__meta">
              {movie.year && <span>{movie.year}</span>}
              {full?.runtime && <span>{formatRuntime(full.runtime)}</span>}
              <Rating value={movie.rating} votes={movie.voteCount} showVotes />
            </div>

            {full?.genres?.length > 0 && (
              <ul className="details__genres" aria-label="Genres">
                {full.genres.map((g) => (
                  <li key={g.id}>
                    <Link to={`/?genres=${g.id}`} className="chip">
                      {g.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <div className="details__actions">
              <WishlistButton movie={full ?? movie} variant="full" />
              {full?.trailer && (
                <button type="button" className="btn btn--ghost" onClick={() => setTrailerOpen(true)}>
                  <PlayIcon width={16} height={16} /> Watch trailer
                </button>
              )}
            </div>

            <section className="details__overview">
              <h2 className="sr-only">Overview</h2>
              <p>{movie.overview || 'No synopsis is available for this movie yet.'}</p>
            </section>

            {!full && query.isFetching && <p className="details__loading">Loading cast and details…</p>}
            {!full && query.isError && <InlineError error={query.error} onRetry={() => query.refetch()} />}

            {facts.length > 0 && (
              <dl className="facts">
                {facts.map(([k, v]) => (
                  <div key={k} className="facts__item">
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            )}

            {(full?.homepage || full?.imdbId) && (
              <p className="details__links">
                {full.homepage && (
                  <a href={full.homepage} target="_blank" rel="noreferrer">
                    Official site
                  </a>
                )}
                {full.imdbId && (
                  <a href={`https://www.imdb.com/title/${full.imdbId}/`} target="_blank" rel="noreferrer">
                    IMDb page
                  </a>
                )}
              </p>
            )}
          </div>
        </div>

        {full?.cast?.length > 0 && (
          <section className="cast" aria-labelledby="cast-heading">
            <h2 id="cast-heading" className="row__title">
              Cast
            </h2>
            <ul className="cast__list">
              {full.cast.map((c) => (
                <li key={`${c.id}-${c.character}`} className="cast__item">
                  <div className="cast__photo">
                    {c.photo ? <img src={c.photo} alt="" loading="lazy" decoding="async" /> : <span aria-hidden="true">{c.name.charAt(0)}</span>}
                  </div>
                  <p className="cast__name">{c.name}</p>
                  {c.character && <p className="cast__role">{c.character}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {full && <MovieRow title="More like this" movies={full.related} />}
      </div>

      <TrailerModal trailer={full?.trailer} open={trailerOpen} onClose={() => setTrailerOpen(false)} />
    </article>
  );
}

function DetailsSkeleton() {
  return (
    <div className="details__inner page-pad" aria-busy="true" aria-label="Loading movie">
      <div className="details__top">
        <div className="poster skeleton details__poster" />
        <div className="details__info">
          <div className="skeleton skeleton--title" />
          <div className="skeleton skeleton--line" />
          <div className="skeleton skeleton--line" />
          <div className="skeleton skeleton--line skeleton--short" />
        </div>
      </div>
    </div>
  );
}
