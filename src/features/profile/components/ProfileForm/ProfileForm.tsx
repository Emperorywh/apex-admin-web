/**
 * 个人资料编辑区（P43 收口）：调度后端未提供资料修改接口，明确呈现不可用。
 *
 * 模板时代的 /users/me 读写接口不存在于调度契约（G01/G02 已确认缺失），
 * 此处不发起任何请求；对登录用户呈现缺口说明（G12），不渲染伪造的编辑表单。
 */

import { Alert } from 'antd'
import { useTranslation } from 'react-i18next'
import type { AuthUser } from '@/types/auth/auth.types'

interface ProfileFormProps {
  user: AuthUser
}

export function ProfileForm({ user }: ProfileFormProps) {
  const { t } = useTranslation('profile')

  return (
    <Alert
      type="info"
      showIcon
      message={t('资料编辑暂不可用')}
      description={t('调度系统暂未提供资料修改接口，当前以登录账号 {{username}} 的信息为准。', {
        username: user.username,
      })}
    />
  )
}
