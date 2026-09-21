import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { CloseIcon, SearchIcon } from './Icons';

/**
 * Search-as-you-type. The input is local state (instant typing); only the
 * DEBOUNCED value goes into the URL, which is what triggers a request.
 * Typing "interstellar" quickly = 1 request, not 12.
 */
export function SearchBar() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const urlQ = location.pathname === '/' ? params.get('q') ?? '' : '';
  const [text, setText] = useState(urlQ);
  const debounced = useDebouncedValue(text.trim(), 350);
  const inputRef = useRef(null);
  const lastPushed = useRef(urlQ);

  // URL changed from elsewhere (Back button, "clear", link) -> reflect it in the box.
  useEffect(() => {
    if (urlQ !== lastPushed.current) {
      lastPushed.current = urlQ;
      setText(urlQ);
    }
  }, [urlQ]);

  const commit = (q) => {
    if (q === lastPushed.current && location.pathname === '/') return;
    lastPushed.current = q;
    const onHome = location.pathname === '/';
    const next = new URLSearchParams(onHome ? location.search : '');
    if (q) next.set('q', q);
    else next.delete('q');
    const qs = next.toString();
    // On the home page, replace (typing shouldn't create 10 history entries);
    // from another page, push so Back returns to where the user was.
    navigate({ pathname: '/', search: qs ? `?${qs}` : '' }, { replace: onHome });
  };

  useEffect(() => {
    if (debounced !== lastPushed.current && (debounced || location.pathname === '/')) commit(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  // "/" focuses search, like many media sites.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <form
      className="search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        commit(text.trim());
        inputRef.current?.blur();
      }}
    >
      <SearchIcon className="search__icon" />
      <input
        ref={inputRef}
        type="search"
        className="search__input"
        placeholder="Search movies"
        aria-label="Search movies by title"
        value={text}
        maxLength={100}
        onChange={(e) => setText(e.target.value)}
        enterKeyHint="search"
        autoComplete="off"
      />
      {text && (
        <button
          type="button"
          className="search__clear"
          aria-label="Clear search"
          onClick={() => {
            setText('');
            commit('');
            inputRef.current?.focus();
          }}
        >
          <CloseIcon width={16} height={16} />
        </button>
      )}
    </form>
  );
}
