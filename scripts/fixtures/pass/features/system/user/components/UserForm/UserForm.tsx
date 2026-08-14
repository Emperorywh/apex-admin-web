import { useUserList } from '@/features/system/user/hooks/useUserList'

export function UserForm() {
  const users = useUserList()
  return <div>{users.length}</div>
}
