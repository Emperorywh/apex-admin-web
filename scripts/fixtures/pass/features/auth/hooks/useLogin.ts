import { authApi } from '@/services/auth/auth.service'

export function useLogin() {
  return { login: authApi.login }
}
