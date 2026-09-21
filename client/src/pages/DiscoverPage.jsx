import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMovieFilters } from '../hooks/useMovieFilters';
import { useMovieFeed } from '../hooks/useMovieFeed';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { moviesApi } from '../api/movies';
import { keys } from '../api/queryClient';
import { SORT_OPTIONS } from '../lib/constants';
import { formatNumber } from '../lib/format';
import { Hero } from '../components/Hero';
import { MovieRow } from '../components/MovieRow';
import { FilterBar } from '../components/FilterBar';
import { MovieGrid, GridSkeleton } from '../components/MovieGrid';
import { InfiniteLoader } from '../components/InfiniteLoader';
import { EmptyState, ErrorState } from '../components/StatusStates';
import { StaleBanner } from '../components/OfflineBanner';

const HEADINGS = {
  popularity: 'Popular right now',
  rating: 'Highest rated',
  newest: 'Newest releases',
  oldest: 'From the archives',
  title_asc: 'All movies, A to Z',
  title_desc: 'All movies, Z to A',
  revenue: 'Biggest box office',
};

export default function DiscoverPage() {
  const filterState = useMovieFilters();
  const { filters, clearFilters, hasActiveFilters, isSearching } = filterState;
  const feed = useMovieFeed(filters);

  // The showcase (hero + trending shelf) is for "just browsing"; it steps aside once the user narrows things down.
  const showcase = !isSearching && !hasActiveFilters && filters.sort === 'popularity';
  const trending = useQuery({
    queryKey: keys.trending('week'),
    queryFn: ({ signal }) => moviesApi.trending('week', signal),
    enabled: showcase,
    staleTime: 15 * 60 * 1000,
    retry: 1,
  });
  const featured = useMemo(() => trending.data?.results.find((m) => m.backdrop), [trending.data]);
  const shelf = useMemo(() => trending.data?.results.filter((m) => m.id !== featured?.id), [trending.data, featured]);

  useDocumentTitle(isSearching ? `Search: ${filters.q}` : null);

  const heading = isSearching ? `Results for "${filters.q}"` : hasActiveFilters ? 'Movies matching your filters' : HEADINGS[filters.sort];
  const sortLabel = SORT_OPTIONS.find((o) => o.value === filters.sort)?.label;

  let body;
  if (feed.isPending) {
    body = <GridSkeleton count={18} />;
  } else if (feed.isError && !feed.isFetchNextPageError) {
    body = <ErrorState error={feed.error} onRetry={() => feed.refetch()} />;
  } else if (feed.movies.length === 0 && !feed.hasNextPage) {
    body = (
      <EmptyState
        title={isSearching ? `No movies match "${filters.q}"` : 'No movies match these filters'}
        action={
          hasActiveFilters && (
            <button type="button" className="btn btn--primary" onClick={clearFilters}>
              Reset filters
            </button>
          )
        }
      >
        <p>
          {isSearching
            ? hasActiveFilters
              ? 'Your filters may be hiding results. Reset them, or try a shorter or differently spelled title.'
              : 'Try a shorter title, check the spelling, or search by the original title.'
            : 'Try a different year, a lower minimum rating, or fewer genres.'}
        </p>
      </EmptyState>
    );
  } else {
    body = (
      <>
        {feed.movies.length > 0 ? (
          <MovieGrid movies={feed.movies} dimmed={feed.isPlaceholderData} />
        ) : (
          <p className="results__note">Looking for more matches…</p>
        )}
        <InfiniteLoader
          hasNextPage={feed.hasNextPage}
          isFetching={feed.isFetchingNextPage}
          fetchNextPage={feed.fetchNextPage}
          error={feed.isFetchNextPageError ? feed.error : null}
          autoLoad={!feed.emptyStreak}
          loadedCount={feed.movies.length}
          total={feed.totalResults}
        />
      </>
    );
  }

  return (
    <>
      {showcase && featured && <Hero movie={featured} />}
      <div className="page-pad">
        {showcase && <MovieRow title="Trending this week" movies={shelf} loading={trending.isPending} />}

        <section className="results" aria-labelledby="results-heading">
          <div className="results__head">
            <h2 id="results-heading" className="results__title">
              {heading}
            </h2>
            {!feed.isPending && !feed.isError && feed.totalResults > 0 && (
              <p className="results__count">
                {feed.filteredLocally
                  ? `Filtered from ${formatNumber(feed.totalResults)} title matches`
                  : `${formatNumber(feed.totalResults)} movies${!isSearching && hasActiveFilters ? `, ${sortLabel.toLowerCase()}` : ''}`}
              </p>
            )}
          </div>

          <FilterBar {...filterState} />

          {feed.isFetching && !feed.isFetchingNextPage && !feed.isPending && <div className="progress" role="progressbar" aria-label="Updating results" />}
          {feed.stale && <StaleBanner />}

          {body}
        </section>
      </div>
    </>
  );
}
