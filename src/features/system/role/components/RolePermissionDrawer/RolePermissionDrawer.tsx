/**
 * 角色权限查看 Drawer（对齐真实后端 rbac 接口，只读）：
 * 打开时经 GET /roles/:roleId 拉取角色详情（RoleDetailResponse），展示已分配权限码
 * 全集与成员数。后端暂无「权限点目录/树」查询端点（GET /permissions/tree 不存在，
 * 仅有当前用户视角的 GET /me/permissions），无法渲染可勾选的全量权限树，
 * 分配操作（PUT /roles/:roleId/permissions 已在 service 就绪）待后端补齐目录端点后接入。
 * Drawer 关闭即销毁内容（destroyOnHidden + 页面按目标角色 id 重建），下次打开重新初始化。
 */
import { useEffect, useState } from 'react'
import type { AxiosRequestConfig } from 'axios'
import { Alert, Button, Drawer, Empty, Spin, Tag, theme } from 'antd'
import { useTranslation } from 'react-i18next'
import { ROLE_I18N_NAMESPACE } from '@/constants/system/role/role.constants'
import { usePageRequest } from '@/hooks/usePageRequest'
import { getRoleDetail } from '@/services/system/role/role.service'
import type { Role, RoleDetail } from '@/types/system/role/role.types'

export interface RolePermissionDrawerProps {
  open: boolean
  /** 查看目标角色；open 为 true 时必须非空 */
  role: Role | null
  onClose: () => void
}

export function RolePermissionDrawer({ open, role, onClose }: RolePermissionDrawerProps) {
  const { t } = useTranslation(ROLE_I18N_NAMESPACE)
  const { token } = theme.useToken()
  const pageRequest = usePageRequest()
  const [detail, setDetail] = useState<RoleDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)

  // Drawer destroyOnHidden：每次打开重新挂载，拉取目标角色的权限详情
  useEffect(() => {
    if (!open || role === null) {
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setLoadError(false)
    // TSX 中泛型箭头函数需尾逗号消歧（<T,>），否则被解析为 JSX 标签
    const sendWithSignal = <T,>(config: AxiosRequestConfig): Promise<T> =>
      pageRequest<T>({ ...config, signal: controller.signal })
    void getRoleDetail(role.id, sendWithSignal)
      .then((result) => {
        if (controller.signal.aborted) {
          return
        }
        setDetail(result)
        setLoading(false)
      })
      .catch(() => {
        // 取消静默；真实失败提示由请求层统一弹出，这里只标记加载失败并允许重开重试
        if (controller.signal.aborted) {
          return
        }
        setLoadError(true)
        setLoading(false)
      })
    return () => {
      controller.abort()
    }
  }, [open, role, pageRequest])

  return (
    <Drawer
      title={t('查看权限')}
      placement="right"
      width={420}
      open={open}
      onClose={onClose}
      destroyOnHidden
    >
      {role !== null && (
        <p style={{ color: token.colorTextSecondary, marginTop: 0 }}>
          {t('目标角色')}：{role.displayName}（{role.code}）
        </p>
      )}
      {loadError && (
        <Alert type="error" showIcon message={t('权限加载失败，请关闭后重试')} style={{ marginBottom: token.marginSM }} />
      )}
      {loading ? (
        <Spin />
      ) : detail !== null ? (
        <>
          <p style={{ color: token.colorTextSecondary }}>
            {t('成员数')}：{detail.memberCount}
          </p>
          {detail.permissionCodes.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: token.marginXS }}>
              {detail.permissionCodes.map((code) => (
                <Tag key={code}>{code}</Tag>
              ))}
            </div>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('暂无权限')} />
          )}
        </>
      ) : (
        !loadError && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('暂无权限')} />
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: token.marginSM, marginTop: token.marginLG }}>
        <Button onClick={onClose}>{t('关闭')}</Button>
      </div>
    </Drawer>
  )
}
