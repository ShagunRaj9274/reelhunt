import { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { wishlistApi } from '../api/wishlist';
import { keys } from '../api/queryClient';
import { useToast } from './Toast';

const Ctx = createContext(null);

/**
 * Add/remove with OPTIMISTIC updates: the button reacts instantly, the request
 * runs in the background, and if it fails we roll back and tell the user.
 *
 * The mutation lives in a provider (not in each button) so it keeps working
 * after the card that triggered it unmounts — e.g. "Undo" after removing a
 * movie from the wishlist page.
 */
export function WishlistActionsProvider({ children }) {
  const qc = useQueryClient();
  const toast = useToast();
  const mutateRef = useRef(null);

  const { mutate } = useMutation({
    mutationKey: ['wishlist'],
    mutationFn: ({ movie, add }) => (add ? wishlistApi.add(movie) : wishlistApi.remove(movie.id)),
    onMutate: async ({ movie, add }) => {
      await qc.cancelQueries({ queryKey: keys.wishlist });
      const previous = qc.getQueryData(keys.wishlist);
      qc.setQueryData(keys.wishlist, (old) => {
        const items = (old?.items ?? []).filter((m) => m.id !== movie.id);
        if (add) items.unshift({ ...movie, addedAt: new Date().toISOString() });
        return { items, count: items.length };
      });
      return { previous };
    },
    onError: (err, { movie, add }, ctx) => {
      if (ctx?.previous) qc.setQueryData(keys.wishlist, ctx.previous);
      toast.show({ tone: 'error', message: `Couldn't ${add ? 'save' : 'remove'} "${movie.title}". ${err?.message ?? ''}`.trim() });
    },
    // Option-level callback (not mutate(..., { onSuccess })): in React Query v5 per-call
    // callbacks only fire for the LATEST call, and we want a toast for every change.
    onSuccess: (_data, { movie, add }) => {
      toast.show({
        message: add ? `Saved "${movie.title}" to your wishlist` : `Removed "${movie.title}" from your wishlist`,
        action: add ? undefined : { label: 'Undo', onClick: () => mutateRef.current({ movie, add: true }) },
      });
    },
    onSettled: () => {
      // Re-sync with the server only once the last in-flight wishlist change finishes,
      // otherwise a refetch could briefly undo a newer optimistic update.
      if (qc.isMutating({ mutationKey: ['wishlist'] }) <= 1) qc.invalidateQueries({ queryKey: keys.wishlist });
    },
  });

  mutateRef.current = mutate;
  const setSaved = useCallback((movie, add) => mutate({ movie, add }), [mutate]);

  const value = useMemo(() => ({ setSaved }), [setSaved]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWishlistActions() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWishlistActions must be used inside WishlistActionsProvider');
  return ctx;
}
