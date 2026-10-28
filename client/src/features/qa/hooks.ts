import { useMutation } from '@tanstack/react-query';
import { services } from '../../services';
import type { AskRequest } from '../../types';

/**
 * POST /ask, as a mutation: each question is a deliberate action, not cached data.
 * An abstained answer resolves normally — check `data.abstained`, not `error`.
 */
export function useAsk() {
  return useMutation({
    mutationFn: (request: AskRequest) => services.qa.ask(request),
  });
}
