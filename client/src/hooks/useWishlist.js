import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { wishlistApi } from '../api/wishlist';
import { keys } from '../api/queryClient';

export function useWishlist() {
  return useQuery({
    queryKey: keys.wishlist,
    queryFn: ({ signal }) => wishlistApi.list(signal),
    staleTime: 60 * 1000,
  });
}

/** O(1) "is this movie saved?" lookups for every card on screen. */
export function useWishlistIds() {
  const { data } = useWishlist();
  return useMemo(() => new Set((data?.items ?? []).map((m) => m.id)), [data]);
}

export { useWishlistActions } from '../context/WishlistActions';
