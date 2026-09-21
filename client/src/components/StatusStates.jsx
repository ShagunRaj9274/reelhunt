import { ReelIcon, WifiOffIcon } from './Icons';

export function EmptyState({ title, children, action }) {
  return (
    <div className="state">
      <ReelIcon width={40} height={40} className="state__icon" />
      <h2 className="state__title">{title}</h2>
      {children && <div className="state__body">{children}</div>}
      {action}
    </div>
  );
}

/** Full-area error with a retry. Message comes from the backend's error contract. */
export function ErrorState({ error, onRetry, title = "Movies didn't load" }) {
  const offline = error?.code === 'NETWORK';
  return (
    <div className="state state--error" role="alert">
      {offline ? <WifiOffIcon width={40} height={40} className="state__icon" /> : <ReelIcon width={40} height={40} className="state__icon" />}
      <h2 className="state__title">{offline ? "You're offline" : title}</h2>
      <p className="state__body">{error?.message ?? 'Something went wrong.'}</p>
      {onRetry && (
        <button type="button" className="btn btn--primary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

/** Compact error used at the end of a list (earlier results stay visible). */
export function InlineError({ error, onRetry }) {
  return (
    <div className="inline-error" role="alert">
      <span>{error?.message ?? 'Loading more failed.'}</span>
      {onRetry && (
        <button type="button" className="btn btn--ghost" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
