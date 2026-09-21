/* Inline SVG icons: no icon font, no extra requests, inherit currentColor. */
const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: 'false' };

export const BookmarkIcon = ({ filled, ...p }) => (
  <svg {...base} {...p} fill={filled ? 'currentColor' : 'none'}>
    <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z" />
  </svg>
);
export const StarIcon = (p) => (
  <svg {...base} {...p} fill="currentColor" stroke="none">
    <path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z" />
  </svg>
);
export const SearchIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);
export const CloseIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const ArrowLeftIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </svg>
);
export const ArrowUpIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </svg>
);
export const PlayIcon = (p) => (
  <svg {...base} {...p} fill="currentColor" stroke="none">
    <path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.2-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5z" />
  </svg>
);
export const ChevronIcon = ({ dir = 'right', ...p }) => (
  <svg {...base} {...p} style={{ transform: dir === 'left' ? 'rotate(180deg)' : undefined }}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);
export const ReelIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="7.5" r="1.6" fill="currentColor" />
    <circle cx="12" cy="16.5" r="1.6" fill="currentColor" />
    <circle cx="7.5" cy="12" r="1.6" fill="currentColor" />
    <circle cx="16.5" cy="12" r="1.6" fill="currentColor" />
  </svg>
);
export const WifiOffIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.2-2.8M19 13a10 10 0 0 0-2.3-1.7M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8A15 15 0 0 0 11 5" />
    <circle cx="12" cy="20" r="0.8" fill="currentColor" />
  </svg>
);
