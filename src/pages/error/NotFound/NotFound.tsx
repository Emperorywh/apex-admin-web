/**
 * 404 页（P42）：真正未匹配路径显示 404 与安全返回；
 * 三个暂缓模块保留已注册路由，落统一暂缓提示，不进入本页（SPEC §4/P42）。
 */

import { useTranslation } from 'react-i18next'
import { Button, Result } from 'antd'
import { useNavigate } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { resolveFirstAccessiblePath } from '@/router/firstAccessible'

export default function NotFound() {
  const { t } = useTranslation('error')
  const navigate = useNavigate()
  const { identity } = useAuth()
  return (
    <Result
      status="404"
      title="404"
      subTitle={t('页面不存在或已被移动')}
      extra={
        <Button type="primary" onClick={() => navigate(resolveFirstAccessiblePath(identity ?? {}))}>
          {t('返回工作台')}
        </Button>
      }
    />
  )
}
