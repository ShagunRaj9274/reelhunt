import { useEffect } from 'react';
import { useInView } from '../hooks/useInView';
import { InlineError } from './StatusStates';

/**
 * Sentinel placed after the grid. When it gets within ~800px of the viewport,
 * the next page is requested — the user never has to press "next".
 *
 * Because the effect depends on `isFetching`, it keeps loading while the
 * sentinel stays visible (e.g. a page that was mostly filtered out).
 * `autoLoad=false` falls back to a manual button — used after errors and
 * when several filtered pages in a row came back empty.
 */
export function InfiniteLoader({ hasNextPage, isFetching, fetchNextPage, error, autoLoad = true, loadedCount, total }) {
  const [ref, inView] = useInView({ rootMargin: '800px 0px', disabled: !hasNextPage });

  useEffect(() => {
    if (inView && hasNextPage && !isFetching && !error && autoLoad) fetchNextPage();
  }, [inView, hasNextPage, isFetching, error, autoLoad, fetchNextPage]);

  if (error) return <InlineError error={error} onRetry={() => fetchNextPage()} />;

  return (
    <div ref={ref} className="loader">
      {isFetching && hasNextPage && (
        <span className="loader__spinner" role="status">
          Loading more movies
        </span>
      )}
      {!isFetching && hasNextPage && !autoLoad && (
        <button type="button" className="btn btn--ghost" onClick={() => fetchNextPage()}>
          Load more
        </button>
      )}
      {!hasNextPage && loadedCount > 0 && (
        <p className="loader__end">
          {total > loadedCount
            ? `End of the catalogue for this view. ${loadedCount.toLocaleString()} movies shown.`
            : `You've reached the end. ${loadedCount.toLocaleString()} movies shown.`}
        </p>
      )}
    </div>
  );
}
