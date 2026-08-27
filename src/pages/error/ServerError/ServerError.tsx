/**
 * 500 页：服务错误内容展示。
 */

import { useTranslation } from 'react-i18next'
import { Button, Result } from 'antd'
import { useNavigate } from 'react-router'
import { FALLBACK_PATH } from '@/constants/route.constants'

export default function ServerError() {
  const { t } = useTranslation('error')
  const navigate = useNavigate()
  return (
    <Result
      status="500"
      title="500"
      subTitle={t('服务暂时不可用，请稍后重试')}
      extra={[
        <Button key="reload" type="primary" onClick={() => window.location.reload()}>
          {t('重新加载')}
        </Button>,
        <Button key="home" type="text" onClick={() => navigate(FALLBACK_PATH)}>
          {t('返回工作台')}
        </Button>,
      ]}
    />
  )
}
