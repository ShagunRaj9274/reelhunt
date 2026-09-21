import { Link, useRouteError } from 'react-router';

/** Last line of defence if a component crashes while rendering. */
export function RouteError() {
  const error = useRouteError();
  console.error(error);
  return (
    <div className="state state--error page-pad" role="alert">
      <h1 className="state__title">This page hit a problem</h1>
      <p className="state__body">Reload the page, or go back to browsing.</p>
      <div className="state__actions">
        <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
          Reload
        </button>
        <Link to="/" className="btn btn--ghost">
          Go to Discover
        </Link>
      </div>
    </div>
  );
}
