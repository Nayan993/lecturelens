import { QueryClient } from '@tanstack/react-query';

/** Shared TanStack Query client. Per-query options may override these defaults. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
