/**
 * 用户角色分配 Drawer（对齐真实后端 rbac 接口）：
 * 打开时经 GET /users/:userId/roles 拉取当前角色 ID 集合（响应键为 snake_case），
 * 以可选角色集合映射为编码勾选；提交走 PUT /users/:userId/roles（body { roleCodes }，
 * 角色编码全量替换），由页面调用 assignUserRoles（silent，错误呈现由本抽屉承担）。
 * Drawer 关闭即销毁内容（destroyOnHidden + 页面按目标用户 id 重建），下次打开重新初始化。
 */
import { useEffect, useState } from 'react'
import type { AxiosRequestConfig } from 'axios'
import { Alert, Button, Checkbox, Drawer, Spin, theme } from 'antd'
import { useTranslation } from 'react-i18next'
import { USER_I18N_NAMESPACE } from '@/constants/system/user/user.constants'
import { usePageRequest } from '@/hooks/usePageRequest'
import { getUserRoles } from '@/services/system/user/user.service'
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
  /** 提交：参数为选中的角色编码列表（后端分配契约按编码全量替换） */
  onSubmit: (roleCodes: string[]) => Promise<void>
  onClose: () => void
}

export function UserRoleDrawer({ open, user, roles, submitting, onSubmit, onClose }: UserRoleDrawerProps) {
  const { t } = useTranslation(USER_I18N_NAMESPACE)
  const { token } = theme.useToken()
  const pageRequest = usePageRequest()
  // 勾选值为角色编码（提交契约）；null 表示初始加载中（不可交互）
  const [checkedCodes, setCheckedCodes] = useState<string[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [submitError, setSubmitError] = useState(false)

  // Drawer destroyOnHidden：每次打开重新挂载，拉取目标用户当前角色作为初始勾选
  useEffect(() => {
    if (!open || user === null) {
      return
    }
    const controller = new AbortController()
    setCheckedCodes(null)
    setLoadError(false)
    // TSX 中泛型箭头函数需尾逗号消歧（<T,>），否则被解析为 JSX 标签
    const sendWithSignal = <T,>(config: AxiosRequestConfig): Promise<T> =>
      pageRequest<T>({ ...config, signal: controller.signal })
    void getUserRoles(user.id, sendWithSignal)
      .then((result) => {
        if (controller.signal.aborted) {
          return
        }
        // role_ids → roleCodes：经可选角色集合做 ID → 编码映射
        const idToCode = new Map(roles.map((role) => [role.id, role.code]))
        setCheckedCodes(
          result.role_ids.map((id) => idToCode.get(id)).filter((code): code is string => code !== undefined),
        )
      })
      .catch(() => {
        // 取消静默；真实失败提示由请求层统一弹出，这里只标记加载失败并允许重试
        if (controller.signal.aborted) {
          return
        }
        setLoadError(true)
      })
    return () => {
      controller.abort()
    }
    // roles 为页面一次性加载的稳定引用，仅作初始勾选的映射输入，不驱动重新拉取
  }, [open, user, roles, pageRequest])

  const handleSubmit = async (): Promise<void> => {
    if (checkedCodes === null) {
      return
    }
    setSubmitError(false)
    try {
      await onSubmit(checkedCodes)
    } catch {
      // 提交请求由页面以 silent 发出；失败提示由本抽屉承担
      setSubmitError(true)
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
      {loadError && (
        <Alert type="error" showIcon message={t('角色加载失败，请关闭后重试')} style={{ marginBottom: token.marginSM }} />
      )}
      {submitError && (
        <Alert type="error" showIcon message={t('角色分配失败，请稍后重试')} style={{ marginBottom: token.marginSM }} />
      )}
      {checkedCodes === null ? (
        <Spin />
      ) : (
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
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: token.marginSM, marginTop: token.marginLG }}>
        <Button onClick={onClose}>{t('取消')}</Button>
        <Button type="primary" loading={submitting} disabled={checkedCodes === null} onClick={() => void handleSubmit()}>
          {t('保存')}
        </Button>
      </div>
    </Drawer>
  )
}
