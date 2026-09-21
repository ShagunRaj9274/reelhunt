import { Link, NavLink } from 'react-router';
import { SearchBar } from './SearchBar';
import { useWishlist } from '../hooks/useWishlist';
import { ReelIcon } from './Icons';

export function Header() {
  const { data } = useWishlist();
  const count = data?.count ?? 0;

  return (
    <header className="header">
      <div className="header__inner">
        <Link to="/" className="brand" aria-label="ReelHunt home">
          <ReelIcon className="brand__mark" width={26} height={26} />
          <span className="brand__name">ReelHunt</span>
        </Link>
        <SearchBar />
        <nav className="nav" aria-label="Main">
          <NavLink to="/" end className="nav__link">
            Discover
          </NavLink>
          <NavLink to="/wishlist" className="nav__link">
            Wishlist
            {count > 0 && (
              <span className="nav__badge" aria-label={`${count} saved`}>
                {count}
              </span>
            )}
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
