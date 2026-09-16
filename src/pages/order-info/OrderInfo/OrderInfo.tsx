/**
 * 任务详情最小入口（T007 阶段边界，P38 完整实现归 T070）。
 *
 * 本卡只交付对象页签身份接入：按 orderTaskKey 区分页签（兼容旧裸 query 形式），
 * 缺失/非法参数显示明确错误且不发送任何业务查询；真实的主信息、子任务分页与
 * 动作展开等详情业务由 T070 按冻结动作接入，本页不预做占位业务。
 */

import { useMemo } from 'react'
import { useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Descriptions, Result } from 'antd'
import { resolveObjectKey } from '@/router/objectTab'

/** 与 definitions 中 order-info 节点 meta.objectParam 保持一致 */
const OBJECT_PARAM = 'orderTaskKey'

export default function OrderInfo() {
  const location = useLocation()
  const { t } = useTranslation('common')

  /** 对象身份解析：规范化参数优先，兼容旧裸 query；缺失即为非法入口 */
  const objectKey = useMemo(
    () => resolveObjectKey(location.search, OBJECT_PARAM),
    [location.search],
  )

  if (!objectKey) {
    return (
      <Result
        status="warning"
        title={t('任务详情')}
        subTitle={t('缺少任务标识：请从任务列表进入，或按 ?orderTaskKey=<任务标识> 访问')}
      />
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <Descriptions bordered size="small" column={1} title={t('任务详情')}>
        <Descriptions.Item label={t('任务标识')}>
          {objectKey}
        </Descriptions.Item>
        <Descriptions.Item label={t('对象页签')}>
          {t('本页签按任务标识独立缓存，与其他任务互不覆盖')}
        </Descriptions.Item>
      </Descriptions>
    </div>
  )
}
