/**
 * 500 服务器错误页（规格 §14.2 /500；视觉 SPEC-UI §8）：需登录、无 permCode；
 * guard/loader 抛错时由 RouterErrorBoundary 提供带「重试/退出登录」的错误界面（规格 §4.3）。
 */
import { Button } from 'antd'
import { ServerCrash } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { StatusResult } from '@/components/StatusResult/StatusResult'
import { ROUTE_PATHS } from '@/constants/route.constants'
import { MENU_NAMESPACE } from '@/i18n/i18n'

export function ServerError() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <StatusResult
      icon={ServerCrash}
      status="500"
      title={t('服务器错误', { ns: MENU_NAMESPACE })}
      subTitle={t('服务器开小差了，请稍后重试')}
      extra={
        <Button type="primary" onClick={() => navigate(ROUTE_PATHS.DASHBOARD, { replace: true })}>
          {t('返回首页')}
        </Button>
      }
    />
  )
}
