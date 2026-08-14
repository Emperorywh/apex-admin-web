import { useAuth } from '@/hooks/useAuth'

export function Auth() {
  const auth = useAuth()
  return <div>{typeof auth}</div>
}
