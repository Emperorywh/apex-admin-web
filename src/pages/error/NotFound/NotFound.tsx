/**
 * 404 页：既可直达（公开路由），也在受保护根内作为 * 兜底。
 */

import { useTranslation } from 'react-i18next'
import { Button, Result } from 'antd'
import { useNavigate } from 'react-router'
import { FALLBACK_PATH } from '@/constants/route.constants'

export default function NotFound() {
  const { t } = useTranslation('error')
  const navigate = useNavigate()
  return (
    <Result
      status="404"
      title="404"
      subTitle={t('页面不存在或已被移动')}
      extra={
        <Button type="primary" onClick={() => navigate(FALLBACK_PATH)}>
          {t('返回工作台')}
        </Button>
      }
    />
  )
}
