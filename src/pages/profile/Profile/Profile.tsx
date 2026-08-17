/**
 * 个人中心页面（规格 §14.2）：路由 /profile，仅要求登录、不分配 permCode（规格 §5.3），
 * 入口为 Header 用户菜单，路由 meta 设 hideInMenu。
 * 基本资料查看/编辑（PUT /auth/profile）与修改密码（PUT /auth/password）复用
 * auth.service 已实现的个人中心端点（规格 §6.3，DTO 权威定义唯一，不另建 profile service）。
 * 资料保存成功后经 profileLoaded 把最新用户写回会话切片，Header 显示名随之同步；
 * 角色与权限快照原样透传，不改变 auth 状态机（登录/登出/刷新编排不受影响）。
 */
import { useState } from 'react'
import { App, Space } from 'antd'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { PROFILE_I18N_NAMESPACE } from '@/constants/profile/profile.constants'
import { PageCard } from '@/components/PageCard/PageCard'
import { ProfileForm } from '@/features/profile/components/ProfileForm/ProfileForm'
import type { ProfileFormSubmitPayload } from '@/features/profile/components/ProfileForm/ProfileForm.types'
import { PasswordForm } from '@/features/profile/components/PasswordForm/PasswordForm'
import type { PasswordFormSubmitPayload } from '@/features/profile/components/PasswordForm/PasswordForm.types'
import { changePassword, updateProfile } from '@/services/auth/auth.service'
import { profileLoaded } from '@/store/slices/user.slice'
import type { RootState } from '@/store/store'

export function Profile() {
  const { t } = useTranslation(PROFILE_I18N_NAMESPACE)
  const { message } = App.useApp()
  const dispatch = useDispatch()
  const user = useSelector((state: RootState) => state.user.user)
  const roles = useSelector((state: RootState) => state.user.roles)
  const permCodes = useSelector((state: RootState) => state.user.permCodes)
  const permissionVersion = useSelector((state: RootState) => state.user.permissionVersion)
  const [profileSubmitting, setProfileSubmitting] = useState(false)
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)

  const handleProfileSubmit = async (dto: ProfileFormSubmitPayload): Promise<void> => {
    setProfileSubmitting(true)
    try {
      // silent：字段映射与页面级错误由 ProfileForm 呈现（规格 §7.4-3/§14.4）
      const updated = await updateProfile(dto, { silent: true })
      message.success(t('资料已更新'))
      // 最新用户写回会话切片：Header 显示名与用户菜单随保存即时同步
      if (permissionVersion !== null) {
        dispatch(profileLoaded({ user: updated, roles, permCodes, permissionVersion }))
      }
    } finally {
      setProfileSubmitting(false)
    }
  }

  const handlePasswordSubmit = async (dto: PasswordFormSubmitPayload): Promise<void> => {
    setPasswordSubmitting(true)
    try {
      // silent：字段映射与页面级错误由 PasswordForm 呈现（规格 §7.4-3/§14.4）
      await changePassword(dto, { silent: true })
      message.success(t('密码修改成功'))
    } finally {
      setPasswordSubmitting(false)
    }
  }

  // 守卫保证受保护路由渲染前 profile 已就绪；防御性处理 user 为空的瞬态
  if (user === null) {
    return null
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {/* 单卡片骨架（SPEC_UI2 §7）：个人中心两张纸面白卡上下堆叠 */}
      <PageCard title={t('基本资料')}>
        <ProfileForm user={user} submitting={profileSubmitting} onSubmit={handleProfileSubmit} />
      </PageCard>
      <PageCard title={t('修改密码')}>
        <PasswordForm submitting={passwordSubmitting} onSubmit={handlePasswordSubmit} />
      </PageCard>
    </Space>
  )
}
