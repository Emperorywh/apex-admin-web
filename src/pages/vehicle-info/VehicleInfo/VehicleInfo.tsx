/**
 * 车辆详情最小入口（T007 阶段边界，P39 完整实现归 T030）。
 *
 * 本卡只交付对象页签身份接入：按 vehicleKey 区分页签（兼容旧裸 query 形式），
 * 缺失/非法参数显示明确错误且不发送任何业务查询；真实的状态描述字段等详情
 * 业务由 T030 按冻结动作接入，本页不预做占位业务。
 */

import { useMemo } from 'react'
import { useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Descriptions, Result } from 'antd'
import { resolveObjectKey } from '@/router/objectTab'

/** 与 definitions 中 vehicle-info 节点 meta.objectParam 保持一致 */
const OBJECT_PARAM = 'vehicleKey'

export default function VehicleInfo() {
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
        title={t('车辆详情')}
        subTitle={t('缺少车辆标识：请从车辆列表进入，或按 ?vehicleKey=<车辆标识> 访问')}
      />
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <Descriptions bordered size="small" column={1} title={t('车辆详情')}>
        <Descriptions.Item label={t('车辆标识')}>
          {objectKey}
        </Descriptions.Item>
        <Descriptions.Item label={t('对象页签')}>
          {t('本页签按车辆标识独立缓存，与其他车辆互不覆盖')}
        </Descriptions.Item>
      </Descriptions>
    </div>
  )
}
