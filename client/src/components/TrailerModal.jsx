import { useEffect, useRef } from 'react';
import { CloseIcon } from './Icons';

/** Native <dialog>: focus trapping, Esc to close and backdrop come for free. */
export function TrailerModal({ trailer, open, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="trailer"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={trailer?.name ?? 'Trailer'}
    >
      <button type="button" className="trailer__close icon-btn" onClick={onClose} aria-label="Close trailer">
        <CloseIcon />
      </button>
      {open && trailer && (
        <div className="trailer__frame">
          <iframe
            src={`${trailer.embedUrl}?autoplay=1&rel=0`}
            title={trailer.name}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>
      )}
    </dialog>
  );
}
