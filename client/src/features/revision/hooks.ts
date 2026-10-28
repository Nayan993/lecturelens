import { useQuery } from '@tanstack/react-query';
import { services } from '../../services';
import { queryKeys } from '../../lib/queryKeys';
import type { Id } from '../../types';

/** GET /revision-plan — `data` is null when the student has no attempts yet. */
export function useRevisionPlan(lectureId?: Id) {
  return useQuery({
    queryKey: queryKeys.revision.plan(lectureId),
    queryFn: () => services.revision.getPlan(lectureId),
  });
}
