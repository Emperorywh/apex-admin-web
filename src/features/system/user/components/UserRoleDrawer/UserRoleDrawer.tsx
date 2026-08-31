/**
 * 用户角色分配 Drawer（纯前端模式）：
 * 目标用户当前角色由页面经内存分配表（user → roleCodes 全量替换语义）以 props 注入，
 * 勾选提交后由页面更新分配表；不再有 GET/PUT /users/:id/roles 网络环节。
 * Drawer 关闭即销毁内容（destroyOnHidden + 页面按目标用户 id 重建），下次打开重新初始化。
 */
import { useState } from 'react'
import { Button, Checkbox, Drawer, theme } from 'antd'
import { useTranslation } from 'react-i18next'
import { USER_I18N_NAMESPACE } from '@/constants/system/user/user.constants'
import type { Role } from '@/types/system/role/role.types'
import type { User } from '@/types/system/user/user.types'

export interface UserRoleDrawerProps {
  open: boolean
  /** 分配目标用户；open 为 true 时必须非空 */
  user: User | null
  /** 可选角色集合（页面经 role.demoData 注入） */
  roles: Role[]
  /** 目标用户当前已分配角色编码全集（初始勾选） */
  assignedRoleCodes: string[]
  /** 提交中：由页面持有，控制提交按钮 loading */
  submitting: boolean
  /** 提交：参数为选中的角色编码列表（分配契约按编码全量替换） */
  onSubmit: (roleCodes: string[]) => Promise<void>
  onClose: () => void
}

export function UserRoleDrawer({
  open,
  user,
  roles,
  assignedRoleCodes,
  submitting,
  onSubmit,
  onClose,
}: UserRoleDrawerProps) {
  const { t } = useTranslation(USER_I18N_NAMESPACE)
  const { token } = theme.useToken()
  // 勾选值为角色编码（提交契约）；随 Drawer 重建以目标用户当前角色初始化
  const [checkedCodes, setCheckedCodes] = useState<string[]>(assignedRoleCodes)

  const handleSubmit = async (): Promise<void> => {
    await onSubmit(checkedCodes)
  }

  return (
    <Drawer title={t('分配角色')} placement="right" width={360} open={open} onClose={onClose} destroyOnHidden>
      {user !== null && (
        <p style={{ color: token.colorTextSecondary, marginTop: 0 }}>
          {t('目标用户')}：{user.displayName}（{user.username}）
        </p>
      )}
      <Checkbox.Group
        value={checkedCodes}
        onChange={(values) => setCheckedCodes(values as string[])}
        style={{ display: 'flex', flexDirection: 'column', gap: token.marginSM }}
      >
        {roles.map((role) => (
          <Checkbox key={role.id} value={role.code}>
            {role.displayName}（{role.code}）
          </Checkbox>
        ))}
      </Checkbox.Group>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: token.marginSM, marginTop: token.marginLG }}>
        <Button onClick={onClose}>{t('取消')}</Button>
        <Button type="primary" loading={submitting} onClick={() => void handleSubmit()}>
          {t('保存')}
        </Button>
      </div>
    </Drawer>
  )
}
