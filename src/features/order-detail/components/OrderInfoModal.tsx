/**
 * 任务详情快速预览弹窗（P03 引入，P38 迁入任务详情业务域 features/order-detail）。
 *
 * 旧实现：OrderInfoModal（antd Descriptions 主体 + antd Table mission 分页 +
 * ExpandedActions 动作展开）。P38 起弹窗改为「壳 + OrderDetailPanel」：
 * 主体/子任务表/动作子表全部由详情业务组件承载，弹窗只负责容器与导航，
 * 与完整详情页（/order-info）共用同一业务实现（TASKS P38：快速预览复用详情业务组件）。
 *
 * 数据与契约（由 OrderDetailPanel 承载，此处只列容器语义）：
 * - 弹窗每次打开从第一页开始（旧实现同语义），关闭销毁 Panel 实例并清空数据；
 * - 新增「完整详情」入口（D08：详情默认工作区页签形态）：关闭弹窗并导航到
 *   /order-info?orderKey=...，列表页签保留快照，构成 P03→P38 往返链路。
 */

import { useCallback } from 'react'
import { Button, Modal } from 'antd'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { buildOrderInfoPath } from '../orderDetailNavigation'
import { OrderDetailPanel } from './OrderDetailPanel'

interface OrderInfoModalProps {
  open: boolean
  /** 目标订单 key（getOrderRecordDetail.orderTaskKey） */
  orderKey: string
  onClose: () => void
}

export function OrderInfoModal({ open, orderKey, onClose }: OrderInfoModalProps) {
  // 详情字段文案沿用 orderRecord 命名空间（P03 已交付四语言旧真译）；
  // P38 新增的「完整详情」入口文案走 orderInfo 命名空间（冻结表归属 P38）
  const { t } = useTranslation(['orderRecord', 'orderInfo'], { nsMode: 'fallback' })
  const navigate = useNavigate()

  /**
   * 打开完整详情页：先关弹窗（销毁 Panel、清数据），再导航到实体页签地址。
   * 列表页签因页签缓存保留筛选/页码快照，构成「列表→详情→返回列表」往返。
   */
  const handleOpenFullDetail = useCallback(() => {
    onClose()
    navigate(buildOrderInfoPath(orderKey))
  }, [onClose, orderKey, navigate])

  return (
    <Modal
      title={t('订单详情')}
      open={open}
      onCancel={onClose}
      footer={
        // 完整详情入口：所有有权限用户可用（目标路由同码守卫，无新增权限面）
        <Button type="primary" onClick={handleOpenFullDetail}>
          {t('完整详情')}
        </Button>
      }
      width={1400}
      destroyOnHidden
    >
      {/* 弹窗打开期间挂载详情业务组件：单请求喂主体+子任务表（destroyOnHidden 关闭即销毁） */}
      {open ? (
        <OrderDetailPanel orderKey={orderKey} descriptionsColumn={2} missionTableHeight={360} />
      ) : null}
    </Modal>
  )
}
