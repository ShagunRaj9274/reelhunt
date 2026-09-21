import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOffIcon } from './Icons';

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div className="banner banner--offline" role="status">
      <WifiOffIcon width={18} height={18} />
      You're offline. Movies you've already opened are still available; new results will load when you reconnect.
    </div>
  );
}

export function StaleBanner() {
  return (
    <div className="banner banner--stale" role="status">
      The movie service isn't responding, so these are saved results from earlier. They'll refresh automatically.
    </div>
  );
}
