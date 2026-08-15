/**
 * 用户角色分配 Drawer（规格 §14.2/§14.3）：
 * 分配角色走独立接口 PUT /users/:id/roles（body { roleIds }），与编辑用户契约分离；
 * 打开时以目标用户当前 roleIds 为初始勾选，提交由页面调用 assignUserRoles（silent，
 * 错误呈现由本抽屉承担）。Drawer 关闭即销毁内容（destroyOnHidden），下次打开重新初始化。
 */
import { useState } from 'react'
import { Alert, Button, Checkbox, Drawer, theme } from 'antd'
import { useTranslation } from 'react-i18next'
import { USER_I18N_NAMESPACE } from '@/constants/system/user/user.constants'
import type { Role } from '@/types/system/role/role.types'
import type { User } from '@/types/system/user/user.types'

export interface UserRoleDrawerProps {
  open: boolean
  /** 分配目标用户；open 为 true 时必须非空 */
  user: User | null
  /** 可选角色集合（页面经 role service 一次性加载） */
  roles: Role[]
  /** 提交中：由页面持有，控制提交按钮 loading */
  submitting: boolean
  /** 提交：抛出错误时由本抽屉以 Alert 呈现 */
  onSubmit: (roleIds: string[]) => Promise<void>
  onClose: () => void
}

export function UserRoleDrawer({ open, user, roles, submitting, onSubmit, onClose }: UserRoleDrawerProps) {
  const { t } = useTranslation(USER_I18N_NAMESPACE)
  const { token } = theme.useToken()
  // Drawer destroyOnHidden：每次打开重新挂载，初始勾选即目标用户当前角色
  const [checkedIds, setCheckedIds] = useState<string[]>(user?.roleIds ?? [])
  const [errorText, setErrorText] = useState<string | null>(null)

  const handleSubmit = async (): Promise<void> => {
    setErrorText(null)
    try {
      await onSubmit(checkedIds)
    } catch {
      // 提交请求由页面以 silent 发出；已知错误文案已由请求层约定，这里显示统一兜底提示
      setErrorText(t('角色分配失败，请稍后重试'))
    }
  }

  return (
    <Drawer
      title={t('分配角色')}
      placement="right"
      width={360}
      open={open}
      onClose={onClose}
      destroyOnHidden
    >
      {user !== null && (
        <p style={{ color: token.colorTextSecondary, marginTop: 0 }}>
          {t('目标用户')}：{user.displayName}（{user.username}）
        </p>
      )}
      {errorText !== null && <Alert type="error" showIcon message={errorText} style={{ marginBottom: token.marginSM }} />}
      <Checkbox.Group
        value={checkedIds}
        onChange={(values) => setCheckedIds(values as string[])}
        style={{ display: 'flex', flexDirection: 'column', gap: token.marginSM }}
      >
        {roles.map((role) => (
          <Checkbox key={role.id} value={role.id}>
            {role.name}（{role.code}）
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
