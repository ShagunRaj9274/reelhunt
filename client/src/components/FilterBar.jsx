import { useGenres } from '../hooks/useGenres';
import { LANGUAGE_OPTIONS, RATING_OPTIONS, SORT_OPTIONS, YEAR_OPTIONS } from '../lib/constants';

function Select({ label, value, options, onChange, disabled, hint }) {
  return (
    <label className={`field ${disabled ? 'is-disabled' : ''}`} title={disabled ? hint : undefined}>
      <span className="field__label">{label}</span>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Filters + sort. Everything writes to the URL via setFilters, so the grid,
 * the cache key and the browser history all follow automatically.
 */
export function FilterBar({ filters, setFilters, clearFilters, hasActiveFilters, isSearching }) {
  const { genres, isError } = useGenres();

  const toggleGenre = (id) => {
    const next = filters.genres.includes(id) ? filters.genres.filter((g) => g !== id) : [...filters.genres, id];
    setFilters({ genres: next.slice(0, 5) });
  };

  return (
    <div className="filters">
      {genres.length > 0 && (
        <div className="chips" role="group" aria-label="Genres">
          {genres.map((g) => {
            const on = filters.genres.includes(g.id);
            return (
              <button key={g.id} type="button" className={`chip ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => toggleGenre(g.id)}>
                {g.name}
              </button>
            );
          })}
        </div>
      )}
      {isError && <p className="filters__note">Genres are unavailable right now. Other filters still work.</p>}

      <div className="filters__row">
        <Select
          label="Sort by"
          value={isSearching ? 'relevance' : filters.sort}
          options={isSearching ? [{ value: 'relevance', label: 'Best match' }] : SORT_OPTIONS}
          onChange={(v) => setFilters({ sort: v })}
          disabled={isSearching}
          hint="Search results are ordered by how well they match"
        />
        <Select label="Year" value={filters.year} options={YEAR_OPTIONS} onChange={(v) => setFilters({ year: v })} />
        <Select label="Rating" value={filters.minRating} options={RATING_OPTIONS} onChange={(v) => setFilters({ minRating: v })} />
        <Select
          label="Language"
          value={isSearching ? '' : filters.language}
          options={LANGUAGE_OPTIONS}
          onChange={(v) => setFilters({ language: v })}
          disabled={isSearching}
          hint="Language filtering isn't available while searching by title"
        />
        {(hasActiveFilters || filters.sort !== 'popularity') && (
          <button type="button" className="btn btn--ghost filters__clear" onClick={clearFilters}>
            Reset filters
          </button>
        )}
      </div>
    </div>
  );
}
