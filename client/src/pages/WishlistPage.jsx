import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useWishlist } from '../hooks/useWishlist';
import { useGenres } from '../hooks/useGenres';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { MovieGrid, GridSkeleton } from '../components/MovieGrid';
import { EmptyState, ErrorState } from '../components/StatusStates';

const SORTS = {
  added: { label: 'Recently saved', fn: (a, b) => (b.addedAt ?? '').localeCompare(a.addedAt ?? '') },
  title: { label: 'Title A to Z', fn: (a, b) => a.title.localeCompare(b.title) },
  rating: { label: 'Highest rated', fn: (a, b) => (b.rating ?? -1) - (a.rating ?? -1) },
  year: { label: 'Newest first', fn: (a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '') },
};

/**
 * The wishlist is small (bounded to 1,000 items server-side), so it is loaded
 * in one request and sorted/filtered on the client: instant, no round-trips.
 */
export default function WishlistPage() {
  useDocumentTitle('Your wishlist');
  const { data, isPending, isError, error, refetch } = useWishlist();
  const { byId } = useGenres();
  const [sort, setSort] = useState('added');
  const [genre, setGenre] = useState('');
  const [text, setText] = useState('');

  const items = data?.items ?? [];
  const genreOptions = useMemo(() => {
    const ids = new Set(items.flatMap((m) => m.genreIds ?? []));
    return [...ids].filter((id) => byId.has(id)).map((id) => ({ id, name: byId.get(id) })).sort((a, b) => a.name.localeCompare(b.name));
  }, [items, byId]);

  const visible = useMemo(() => {
    const t = text.trim().toLowerCase();
    return items
      .filter((m) => (!genre || m.genreIds?.includes(Number(genre))) && (!t || m.title.toLowerCase().includes(t)))
      .sort(SORTS[sort].fn);
  }, [items, genre, text, sort]);

  return (
    <div className="page-pad">
      <section className="results" aria-labelledby="wl-heading">
        <div className="results__head">
          <h1 id="wl-heading" className="results__title results__title--page">
            Your wishlist
          </h1>
          {items.length > 0 && <p className="results__count">{items.length === 1 ? '1 movie saved' : `${items.length} movies saved`}</p>}
        </div>

        {items.length > 0 && (
          <div className="filters filters__row">
            <label className="field field--grow">
              <span className="field__label">Find in wishlist</span>
              <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Title" />
            </label>
            <label className="field">
              <span className="field__label">Genre</span>
              <select value={genre} onChange={(e) => setGenre(e.target.value)}>
                <option value="">All genres</option>
                {genreOptions.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Sort by</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                {Object.entries(SORTS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {isPending ? (
          <GridSkeleton count={6} />
        ) : isError ? (
          <ErrorState title="Your wishlist didn't load" error={error} onRetry={() => refetch()} />
        ) : items.length === 0 ? (
          <EmptyState title="Nothing saved yet" action={<Link to="/" className="btn btn--primary">Browse movies</Link>}>
            <p>Tap the bookmark on any movie to keep it here. Your list stays on this browser even after you close it.</p>
          </EmptyState>
        ) : visible.length === 0 ? (
          <EmptyState
            title="No saved movies match"
            action={
              <button type="button" className="btn btn--ghost" onClick={() => { setText(''); setGenre(''); }}>
                Show all saved movies
              </button>
            }
          />
        ) : (
          <MovieGrid movies={visible} />
        )}
      </section>
    </div>
  );
}
