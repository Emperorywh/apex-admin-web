/**
 * UserForm 私有类型。
 */

import type { UserEntity } from '@/types/system/user/user.types'

export interface UserFormValues {
  username: string
  password?: string
  displayName: string
  email?: string
  roleCodes: string[]
}

export interface UserFormProps {
  open: boolean
  /** 编辑目标；null 表示新建 */
  user: UserEntity | null
  roleOptions: Array<{ code: string; name: string }>
  saving: boolean
  onOk: (values: UserFormValues) => void
  onCancel: () => void
}
