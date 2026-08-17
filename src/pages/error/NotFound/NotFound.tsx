/**
 * 404 页面不存在（规格 §14.2；视觉 SPEC-UI §8）：显式 /404 与受保护根 * 兜底共用本组件
 * （规格 §4.2）；需登录、无 permCode。
 */
import { Button } from 'antd'
import { FileQuestion } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { StatusResult } from '@/components/StatusResult/StatusResult'
import { ROUTE_PATHS } from '@/constants/route.constants'
import { MENU_NAMESPACE } from '@/i18n/i18n'

export function NotFound() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <StatusResult
      icon={FileQuestion}
      status="404"
      title={t('页面不存在', { ns: MENU_NAMESPACE })}
      subTitle={t('您访问的页面不存在')}
      extra={
        <Button type="primary" onClick={() => navigate(ROUTE_PATHS.DASHBOARD, { replace: true })}>
          {t('返回首页')}
        </Button>
      }
    />
  )
}
