/**
 * 500 服务器错误页（规格 §14.2 /500）：需登录、无 permCode；
 * guard/loader 抛错时由 RouterErrorBoundary 提供带「重试/退出登录」的错误界面（规格 §4.3）。
 */
import { Button, Result } from 'antd'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { ROUTE_PATHS } from '@/constants/route.constants'
import { MENU_NAMESPACE } from '@/i18n/i18n'

export function ServerError() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <Result
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
