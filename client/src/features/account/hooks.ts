import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { services } from '../../services';
import type { UpdateProfilePayload } from '../../types';

/** PATCH /users/me, then refresh the signed-in user so the sidebar and greeting update. */
export function useUpdateProfile() {
  const { refresh } = useAuth();
  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) => services.auth.updateProfile(payload),
    onSuccess: () => refresh(),
  });
}
