/**
 * 403 页：已登录但权限不足。
 */

import { useTranslation } from 'react-i18next'
import { Button, Result } from 'antd'
import { useNavigate } from 'react-router'
import { FALLBACK_PATH } from '@/constants/route.constants'

export default function Forbidden() {
  const { t } = useTranslation('error')
  const navigate = useNavigate()
  return (
    <Result
      status="403"
      title="403"
      subTitle={t('当前账号无权访问该页面')}
      extra={
        <Button type="primary" onClick={() => navigate(FALLBACK_PATH)}>
          {t('返回工作台')}
        </Button>
      }
    />
  )
}
