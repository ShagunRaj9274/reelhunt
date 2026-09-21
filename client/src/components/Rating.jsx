import { StarIcon } from './Icons';
import { formatCount } from '../lib/format';

export function Rating({ value, votes, showVotes = false }) {
  if (value == null) return <span className="rating rating--none">Not rated</span>;
  return (
    <span className="rating" aria-label={`Rated ${value} out of 10${votes ? ` from ${votes} votes` : ''}`}>
      <StarIcon width={14} height={14} className="rating__star" />
      <span className="rating__value">{value.toFixed(1)}</span>
      {showVotes && votes ? <span className="rating__votes">({formatCount(votes)} votes)</span> : null}
    </span>
  );
}
