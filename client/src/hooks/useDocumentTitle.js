import { useEffect } from 'react';

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | ReelHunt` : 'ReelHunt — Discover movies';
  }, [title]);
}
