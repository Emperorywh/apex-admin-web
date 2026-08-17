/**
 * 403 无权限页（规格 §14.2 /403；视觉 SPEC-UI §8）：需登录、无 permCode；
 * 标题经 menu 命名空间翻译，提供返回首页（Dashboard）出口。
 */
import { Button } from 'antd'
import { ShieldX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { StatusResult } from '@/components/StatusResult/StatusResult'
import { ROUTE_PATHS } from '@/constants/route.constants'
import { MENU_NAMESPACE } from '@/i18n/i18n'

export function Forbidden() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <StatusResult
      icon={ShieldX}
      status="403"
      title={t('无权限访问', { ns: MENU_NAMESPACE })}
      subTitle={t('您没有访问该页面的权限')}
      extra={
        <Button type="primary" onClick={() => navigate(ROUTE_PATHS.DASHBOARD, { replace: true })}>
          {t('返回首页')}
        </Button>
      }
    />
  )
}
