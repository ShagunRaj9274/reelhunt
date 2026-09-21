import { useWishlistActions, useWishlistIds } from '../hooks/useWishlist';
import { BookmarkIcon } from './Icons';

/** Toggle for saving a movie. `variant="icon"` on cards, `"full"` on the details page. */
export function WishlistButton({ movie, variant = 'icon' }) {
  const ids = useWishlistIds();
  const { setSaved } = useWishlistActions();
  const saved = ids.has(movie.id);
  const label = saved ? `Remove ${movie.title} from wishlist` : `Save ${movie.title} to wishlist`;

  return (
    <button
      type="button"
      className={`wish-btn wish-btn--${variant} ${saved ? 'is-saved' : ''}`}
      aria-pressed={saved}
      aria-label={variant === 'icon' ? label : undefined}
      title={variant === 'icon' ? label : undefined}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setSaved(movie, !saved);
      }}
    >
      <BookmarkIcon filled={saved} />
      {variant === 'full' && <span>{saved ? 'In your wishlist' : 'Save to wishlist'}</span>}
    </button>
  );
}
