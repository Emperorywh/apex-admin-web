import { useLogin } from '../hooks/useLogin'

export function LoginForm() {
  const { login } = useLogin()
  return <button type="button" onClick={() => login()} />
}
