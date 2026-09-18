/**
 * 车辆详情业务组件（P39）：getVehicleState 单请求喂主体 Descriptions。
 *
 * 完整详情页（/vehicle-info，工作区页签/独立窗口）唯一数据区域；如后续需要
 * 快速预览复用，只换外壳与列数参数（同构 P38 OrderDetailPanel 模式）。
 *
 * 数据与契约：
 * - GET getVehicleState（query: vehicleKey，G04 平铺）：车辆调度域完整状态；
 * - 实时性（任务卡 P39：复用可见轮询机制）：useVisiblePolling 约 5 秒可见串行
 *   轮询，后台页签保留快照，重新可见立即刷新（A12/D14）；
 * - 失败清空对应远端区域（任务卡专项验收）：查询失败时 detail 置空并呈现真实
 *   错误，不保留旧快照冒充当前状态；恢复由轮询退避后的自动重查完成
 *   （按钮纪律：无手动重试/刷新按钮）；
 * - 车辆不存在（data=null，呈现语义与任务详情同族）：StateBlock 明确反馈并
 *   停止轮询（稳定态，重复查询无意义）；
 * - 展示转换见 vehicleDetailOptions（递归展平/枚举映射/空值留白纪律）。
 */

import { useCallback, useMemo, useState } from 'react'
import { Descriptions } from 'antd'
import { useTranslation } from 'react-i18next'
import { StateBlock } from '@/components/StateBlock/StateBlock'
import { useVisiblePolling } from '@/hooks/useVisiblePolling'
import { apiErrorMessage } from '@/services/request/request'
import { fetchVehicleState } from '@/services/vehicle/vehicle-state.service'
import type { VehicleStateRecordDto } from '@/services/vehicle/vehicle-state.service.types'
import { flattenVehicleState } from '../vehicleDetailOptions'
import styles from './VehicleDetailPanel.module.css'

interface VehicleDetailPanelProps {
  /** 目标车辆唯一标识（getVehicleState.vehicleKey） */
  vehicleKey: string
  /** 描述列表列数：完整页 3 列（旧 /vehicle-info 形态） */
  descriptionsColumn?: 2 | 3
}

export function VehicleDetailPanel({
  vehicleKey,
  descriptionsColumn = 3,
}: VehicleDetailPanelProps) {
  const { t } = useTranslation('vehicleInfo')

  // 车辆状态主体：轮询成功刷新；失败/不存在时清空（不保留旧快照误导）
  const [detail, setDetail] = useState<VehicleStateRecordDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  // 车辆不存在：稳定态，呈现明确反馈并停止轮询（与查询失败、加载中分开）
  const [notFound, setNotFound] = useState(false)

  /** 轮询单次刷新：signal 透传请求层；失败写错误态并清空数据区域（A12/DoD 6） */
  const refresh = useCallback(
    async (signal: AbortSignal) => {
      try {
        const data = await fetchVehicleState({ vehicleKey }, { signal })
        if (signal.aborted) return
        if (!data) {
          // 车辆不存在（呈现语义同族任务详情 data=null 实证）：明确反馈，停止轮询
          setDetail(null)
          setError(null)
          setNotFound(true)
          return
        }
        setDetail(data)
        setError(null)
        setNotFound(false)
      } catch (err) {
        // 主动取消（页签关闭/隐藏/刷新重建）静默；真实失败清空远端区域并呈现错误
        if (signal.aborted) return
        setDetail(null)
        setError(apiErrorMessage(err) ?? t('查询车辆信息出错'))
      }
    },
    [vehicleKey, t],
  )

  // 可见串行轮询：不存在态停止（enabled=false），其余状态持续刷新
  useVisiblePolling({ refresh, enabled: !notFound })

  // 展平字段（纯转换）；label 走 t()（缺 key 显示原字段名，同旧 orderRefer||key 口径）
  const items = useMemo(() => {
    if (!detail) return []
    return flattenVehicleState(detail).map((field) => ({
      key: field.key,
      label: t(field.labelKey),
      children:
        field.text === null ? '' : field.literal ? field.text : t(field.text),
    }))
  }, [detail, t])

  // 车辆不存在：明确反馈（稳定态，轮询已停止）
  if (notFound) {
    return (
      <div className={styles.panel}>
        <StateBlock variant="gap" description={t('车辆不存在或已被删除')} />
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      {/* 查询失败：远端区域已清空，呈现真实错误；恢复靠轮询退避自动重查（无重试按钮） */}
      {error ? (
        <StateBlock variant="offline" description={t('查询车辆信息出错') + error} />
      ) : null}
      {detail ? (
        <Descriptions size="small" bordered column={descriptionsColumn} items={items} />
      ) : null}
      {/* 加载中/被清空后未恢复：不出空表壳，区域留白等待轮询回填（不伪造进度） */}
      {!detail && !error ? <div className={styles.placeholder} /> : null}
    </div>
  )
}
