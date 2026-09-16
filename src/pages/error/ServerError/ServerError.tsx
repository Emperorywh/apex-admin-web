/**
 * 500 页：服务错误内容展示。
 */

import { useTranslation } from 'react-i18next'
import { Button, Result } from 'antd'
import { useNavigate } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { resolveFirstAccessiblePath } from '@/router/firstAccessible'

export default function ServerError() {
  const { t } = useTranslation('error')
  const navigate = useNavigate()
  const { identity } = useAuth()
  return (
    <Result
      status="500"
      title="500"
      subTitle={t('服务暂时不可用，请稍后重试')}
      extra={[
        <Button key="reload" type="primary" onClick={() => window.location.reload()}>
          {t('重新加载')}
        </Button>,
        <Button
          key="home"
          type="text"
          onClick={() => navigate(resolveFirstAccessiblePath(identity ?? {}))}
        >
          {t('返回工作台')}
        </Button>,
      ]}
    />
  )
}
