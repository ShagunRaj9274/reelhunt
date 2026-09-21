/** Must match the sort keys exposed by the backend (server/src/services/movieService.js). */
export const SORT_OPTIONS = [
  { value: 'popularity', label: 'Most popular' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'newest', label: 'Newest releases' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'title_asc', label: 'Title A to Z' },
  { value: 'title_desc', label: 'Title Z to A' },
  { value: 'revenue', label: 'Box office' },
];

export const RATING_OPTIONS = [
  { value: '', label: 'Any rating' },
  { value: '5', label: '5+ stars' },
  { value: '6', label: '6+ stars' },
  { value: '7', label: '7+ stars' },
  { value: '8', label: '8+ stars' },
];

/** A curated subset — TMDB supports many more, but a 180-item dropdown is not usable. */
export const LANGUAGE_OPTIONS = [
  { value: '', label: 'Any language' },
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' },
  { value: 'ml', label: 'Malayalam' },
  { value: 'kn', label: 'Kannada' },
  { value: 'bn', label: 'Bengali' },
  { value: 'ko', label: 'Korean' },
  { value: 'ja', label: 'Japanese' },
  { value: 'zh', label: 'Chinese' },
  { value: 'fr', label: 'French' },
  { value: 'es', label: 'Spanish' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
];

const thisYear = new Date().getFullYear();
export const YEAR_OPTIONS = [
  { value: '', label: 'Any year' },
  ...Array.from({ length: thisYear + 2 - 1920 }, (_, i) => {
    const y = String(thisYear + 1 - i);
    return { value: y, label: y };
  }),
];
