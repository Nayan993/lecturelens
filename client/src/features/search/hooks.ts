import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { services } from '../../services';
import { queryKeys } from '../../lib/queryKeys';
import type { SearchRequest } from '../../types';

/** POST /search. Disabled until there is a non-empty query; previous results stay visible while typing. */
export function useSearch(request: SearchRequest) {
  const query = request.query.trim();
  const normalised: SearchRequest = { ...request, query };
  return useQuery({
    queryKey: queryKeys.search(normalised),
    queryFn: () => services.search.search(normalised),
    enabled: query.length > 0,
    placeholderData: keepPreviousData,
  });
}
